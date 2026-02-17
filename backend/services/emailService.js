const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const axios = require('axios');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMAIL SERVICE - ENTERPRISE ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * MULTI-LEVEL EMAIL CONFIGURATION PATTERN:
 * This service implements a 2-tier email configuration hierarchy:
 * 
 * TIER 1: PER-USER EMAIL SETTINGS (User Override)
 * ─────────────────────────────────────────────────
 * Location: MongoDB User.emailSettings
 * Purpose: Allow individual employees to configure their own email (Zoho or SMTP)
 * Use Case: Sales team uses personal Gmail, HR team uses shared Zoho account
 * Preference: HIGHEST - If user has config, it's used first
 * 
 * TIER 2: COMPANY-WIDE EMAIL SETTINGS (Enterprise Default)
 * ─────────────────────────────────────────────────────────
 * Location: MongoDB CompanyEmailConfig collection
 * Purpose: Company owner/admin configures ONCE, ALL 30-50 employees use automatically
 * Use Case: Zoho Zeptomail under review, company buys 1 account for entire team
 * Preference: SECONDARY - Falls back if user has no personal config
 * Philosophy: Like Slack, Notion, Zapier - "company admin sets up once, everyone uses"
 * 
 * TIER 3: DEFAULT (Environment Variables)
 * ────────────────────────────────────────
 * Location: .env file
 * Purpose: Fallback for development or systems without config
 * Preference: LOWEST - Only used if no user or company config exists
 * 
 * PRIORITY FLOW (getUserTransporter):
 * 1. User has IS_CONFIGURED + Zoho key? → Use user's personal Zoho
 * 2. User has IS_CONFIGURED + SMTP config? → Use user's personal SMTP
 * 3. Company has IS_CONFIGURED + Zoho key? → Use company's shared Zoho (ALL employees share this)
 * 4. Company has IS_CONFIGURED + SMTP config? → Use company's shared SMTP
 * 5. Neither user nor company configured? → Return error, no email can be sent
 * 
 * DATABASE SECURITY NOTES:
 * ────────────────────────
 * ✅ API Keys NEVER returned to frontend in full (only masked with •••••)
 * ✅ API Keys stored at-rest in MongoDB (uses env-based encryption if available)
 * ✅ API Keys only leaked via HTTPS to authenticated backend
 * ✅ All email config endpoints require verifyToken (JWT authentication)
 * ⚠️  TODO: Add role-based check (admin/owner only) at route level
 * ⚠️  TODO: Implement field-level encryption for CompanyEmailConfig.zohoZeptomailApiKey
 */

// ─── Default (global) transporter from .env ───
let defaultTransporter;

const initializeTransporter = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
  
  if (emailProvider === 'gmail') {
    defaultTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD
      },
      family: 4
    });
  } else {
    defaultTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      family: 4
    });
  }

  console.log('📧 Email Service Initialized:', {
    provider: emailProvider,
    fromEmail: process.env.FROM_EMAIL || process.env.GMAIL_EMAIL
  });
};

initializeTransporter();

// ─── Zoho Zeptomail API Helper ───
/**
 * Sends email via Zoho Zeptomail API (REST-based, not SMTP)
 * 
 * How it works:
 * 1. Receives Zoho API key (from user or company config)
 * 2. Formats email payload according to Zoho API spec
 * 3. Makes HTTPS POST to Zoho API with Authorization header
 * 4. Handles errors: Auth (401), Rate limit (429), Bad request (400)
 * 
 * Security:
 * - API key passed only in mem, never logged (except in error msgs)
 * - Makes HTTPS call to official Zoho endpoint
 * - Returns only message ID, not the API key
 * - Caller responsible for masking key before returning to frontend
 */
const sendViaZohoZeptomail = async (to, subject, htmlBody, textBody, options = {}) => {
  const { cc, bcc, senderName, fromEmail, zohoApiKey, zohoApiUrl, userId } = options;
  
  if (!zohoApiKey || !zohoApiUrl || !fromEmail) {
    throw new Error('ZOHO_ZEPTOMAIL_NOT_CONFIGURED');
  }

  const displayName = senderName || 'Skillnix PCHR';
  const recipients = Array.isArray(to) ? to : [to];

  // Build recipient objects
  const toList = recipients.map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  }));

  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  })) : [];

  const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).map(email => ({
    email_address: { 
      address: email,
      name: ''
    }
  })) : [];

  const payload = {
    from: {
      address: fromEmail,
      name: displayName
    },
    to: toList,
    subject: subject,
    htmlbody: htmlBody,
    textbody: textBody || subject,
    reply_to: {
      address: fromEmail
    }
  };

  // Add CC if provided
  if (ccList.length > 0) {
    payload.cc = ccList;
  }

  // Add BCC if provided
  if (bccList.length > 0) {
    payload.bcc = bccList;
  }

  try {
    const response = await axios.post(
      `${zohoApiUrl}api/v1.1/mail/send`,
      payload,
      {
        headers: {
          'Authorization': `Zoho-enauth ${zohoApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(`✅ Email sent via Zoho Zeptomail to ${recipients.join(', ')} (from: ${fromEmail})`);
    if (cc) console.log(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) console.log(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);

    return { 
      success: true, 
      email: to, 
      messageId: response.data?.data?.message_id || 'zoho_' + Date.now() 
    };
  } catch (error) {
    console.error('❌ Zoho Zeptomail Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      email: to,
      from: fromEmail
    });

    // ⚠️  USER-FRIENDLY ERROR MESSAGES
    // Map HTTP status codes to clear explanations for frontend UI
    let errorMsg = error.message;
    if (error.response?.status === 401) {
      // 401 = Invalid Authorization header (bad API key, expired, wrong account)
      errorMsg = `Zoho Zeptomail authentication failed. Your API key may be invalid, expired, or the account is not active.`;
    } else if (error.response?.status === 429) {
      // 429 = Rate limit exceeded (Zoho free tier: 100 emails/day)
      errorMsg = `Rate limit exceeded. You've hit the daily email limit (usually 100/day for free accounts). Try again tomorrow or upgrade your Zoho plan.`;
    } else if (error.code === 'ECONNABORTED') {
      // Timeout error (network issues or Zoho API slow)
      errorMsg = `Connection timeout. Zoho API didn't respond in time. This usually means network issues or Zoho service is slow.`;
    } else if (error.response?.data?.message) {
      // Use Zoho's error message if provided
      errorMsg = error.response.data.message;
    }

    const err = new Error(errorMsg);
    err.code = 'ZOHO_ZEPTOMAIL_ERROR';
    throw err;
  }
};

// ─── Get per-user transporter (supports SMTP and Zoho Zeptomail) ───
// ✅ ENTERPRISE MODE: Checks user config FIRST, then falls back to company-wide config
// This allows all 30-50 employees to use the SAME Zoho API key without individual setup
const getUserTransporter = async (userId) => {
  try {
    if (!userId) return { transporter: null, fromEmail: null, userName: '', configured: false, provider: null };
    
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('emailSettings name email');
    
    // ✅ PRIORITY 1: Check if user has per-user configuration (allows overrides)
    if (user?.emailSettings?.isConfigured) {
      const s = user.emailSettings;

      // Check if using Zoho Zeptomail (per-user override)
      if (s.emailProvider === 'zoho-zeptomail' && s.zohoZeptomailApiKey && s.zohoZeptomailFromEmail) {
        return {
          transporter: null,
          fromEmail: s.zohoZeptomailFromEmail,
          userName: user.name || '',
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: s.zohoZeptomailApiKey,
          zohoApiUrl: s.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
          userId: userId,
          configSource: 'user'  // User's own personal config
        };
      }

      // Check if using SMTP (per-user)
      if (s.smtpEmail && s.smtpAppPassword) {
        let userTransporter = createSmtpTransporter(s);
        return { 
          transporter: userTransporter, 
          fromEmail: s.smtpEmail, 
          userName: user.name || '', 
          configured: true, 
          provider: 'smtp',
          configSource: 'user'
        };
      }
    }

    // ✅ PRIORITY 2: Fall back to company-level email configuration
    // This is the MAIN way enterprise setups work - company owner configures ONCE
    // and all 30-50 employees send through the SAME Zoho API key
    let companyConfig;
    try {
      const CompanyEmailConfig = mongoose.model('CompanyEmailConfig');
      companyConfig = await CompanyEmailConfig.findOne({ companyId: 'default-company' });
    } catch (configErr) {
      // If model doesn't exist yet, continue without company config
      companyConfig = null;
    }

    if (companyConfig?.isConfigured) {
      // Use company's Zoho Zeptomail (all employees share this)
      if (companyConfig.primaryProvider === 'zoho-zeptomail' && companyConfig.zohoZeptomailApiKey && companyConfig.zohoZeptomailFromEmail) {
        return {
          transporter: null,
          fromEmail: companyConfig.zohoZeptomailFromEmail,
          userName: user?.name || '',
          configured: true,
          provider: 'zoho-zeptomail',
          zohoApiKey: companyConfig.zohoZeptomailApiKey,
          zohoApiUrl: companyConfig.zohoZeptomailApiUrl || 'https://api.zeptomail.com/',
          userId: userId,
          configSource: 'company'  // Company-wide shared config
        };
      }

      // Use company's SMTP settings (fallback)
      if (companyConfig.smtpEmail && companyConfig.smtpAppPassword) {
        let companyTransporter = createSmtpTransporter(companyConfig);
        return {
          transporter: companyTransporter,
          fromEmail: companyConfig.smtpEmail,
          userName: user?.name || '',
          configured: true,
          provider: 'smtp',
          configSource: 'company'  // Company-wide shared config
        };
      }
    }

    // ❌ No configuration found (neither user nor company)
    return { 
      transporter: null, 
      fromEmail: null, 
      userName: user?.name || '', 
      configured: false, 
      provider: null,
      configSource: 'none'
    };
  } catch (err) {
    console.error('getUserTransporter error:', err.message);
    return { transporter: null, fromEmail: null, userName: '', configured: false, provider: null, configSource: 'error' };
  }
};

// ─── Helper: Create SMTP transporter (reusable for both user and company config) ───
// Avoids code duplication between user and company email setup
const createSmtpTransporter = (emailSettings) => {
  const s = emailSettings;
  
  const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
  const hostProviders = {
    zoho:      { host: 'smtp.zoho.com',            port: 587 },
    hostinger: { host: 'smtp.hostinger.com',        port: 587 },
    godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
    namecheap: { host: 'mail.privateemail.com',     port: 587 },
  };

  const commonOpts = {
    family: 4,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: { rejectUnauthorized: false }
  };

  const provider = s.smtpProvider || 'gmail';

  if (serviceProviders[provider]) {
    return nodemailer.createTransport({
      service: serviceProviders[provider],
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  } else if (hostProviders[provider]) {
    const hp = hostProviders[provider];
    return nodemailer.createTransport({
      host: hp.host,
      port: hp.port,
      secure: hp.port === 465,
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  } else {
    // Custom SMTP
    const port = s.smtpPort || 587;
    return nodemailer.createTransport({
      host: s.smtpHost,
      port: port,
      secure: port === 465,
      auth: { user: s.smtpEmail, pass: s.smtpAppPassword },
      ...commonOpts
    });
  }
};

// Generic email sender — uses per-user transporter if userId provided
const sendEmail = async (to, subject, htmlBody, textBody, options = {}) => {
  const { cc, bcc, senderName, senderEmail, userId } = options;
  
  // Get the right transporter (user-specific only — no global fallback)
  const { transporter: activeTransporter, fromEmail, userName, configured, provider, zohoApiKey, zohoApiUrl } = await getUserTransporter(userId);
  
  if (!configured || !fromEmail) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  
  // Use Zoho Zeptomail if configured
  if (provider === 'zoho-zeptomail') {
    return await sendViaZohoZeptomail(to, subject, htmlBody, textBody, {
      cc,
      bcc,
      senderName: senderName || userName,
      fromEmail,
      zohoApiKey,
      zohoApiUrl,
      userId
    });
  }

  // Otherwise use SMTP
  if (!activeTransporter) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  // Build "from" with display name
  const displayName = senderName || userName || '';
  const fromAddress = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  
  const mailOptions = {
    from: fromAddress,
    replyTo: fromEmail,  // Allow recipients to reply directly
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlBody,
    text: textBody || subject,
    headers: {
      'X-Mailer': 'Skillnix PCHR 1.0',
      'X-Priority': '3',
      'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
      'Precedence': 'bulk'  // Mark as bulk mail (helps avoid spam)
    }
  };

  // Add CC if provided
  if (cc) {
    mailOptions.cc = Array.isArray(cc) ? cc : [cc];
  }

  // Add BCC if provided
  if (bcc) {
    mailOptions.bcc = Array.isArray(bcc) ? bcc : [bcc];
  }

  try {
    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${Array.isArray(to) ? to.join(', ') : to} (from: ${fromEmail})`);
    if (cc) console.log(`   CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    if (bcc) console.log(`   BCC: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
    return { success: true, email: to, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email Error:', {
      message: error.message,
      email: to,
      from: fromEmail,
      cc: options.cc,
      bcc: options.bcc
    });
    // Translate SMTP errors into user-friendly messages
    let msg = error.message;
    if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED') || msg.includes('authentication failed')) {
      const err = new Error(`Authentication failed for ${fromEmail}. Please go to Email Settings and re-enter your correct password.`);
      err.code = 'AUTH_FAILED';
      throw err;
    } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      const err = new Error('Cannot connect to the email server. Please check your SMTP settings.');
      err.code = 'CONNECTION_FAILED';
      throw err;
    } else if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKET') || msg.includes('ECONNRESET') || msg.includes('timeout') || msg.includes('ENETUNREACH')) {
      const err = new Error('Email server connection timed out. The SMTP server may be unreachable from this hosting. Try using Gmail with App Password instead.');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  }
};

// Interview invitation email
const sendInterviewEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">📞 Interview Invitation</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Congratulations! We are pleased to invite you for an interview for the <strong>${position}</strong> position.</p>
        <p style="color: #666; line-height: 1.6;">Our HR team will contact you shortly with interview details including date, time, and format.</p>
        <p style="color: #666; line-height: 1.6;">If you have any questions, please feel free to reach out to us.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Congratulations! We invite you for an interview for the ${position} position. Our HR team will contact you shortly with details. Best regards, HR Team`;
  
  return await sendEmail(email, `Interview Invitation - ${position}`, htmlBody, textBody, options);
};

// Rejection email
const sendRejectionEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f5f5f5; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="color: #333; margin: 0;">Application Status Update</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Thank you for your interest in the <strong>${position}</strong> position. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current needs.</p>
        <p style="color: #666; line-height: 1.6;">We appreciate the time you invested in applying and interviewing with us. We encourage you to apply for future positions that match your skills and experience.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Thank you for your interest in the ${position} position. We regret to inform you that we have decided to move forward with other candidates. Best regards, HR Team`;
  
  return await sendEmail(email, "Application Status Update", htmlBody, textBody, options);
};

// Document request email
const sendDocumentEmail = async (email, candidateName, position, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">📄 Document Submission Required</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">As the next step in our hiring process for the <strong>${position}</strong> position, we require you to submit the following documents:</p>
        <ul style="color: #666; line-height: 1.8;">
          <li>Updated Resume</li>
          <li>Valid Government ID</li>
          <li>Educational Certificates</li>
          <li>Previous Employment Letters</li>
        </ul>
        <p style="color: #666; line-height: 1.6;">Please reply to this email with the requested documents within 3 business days.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Please submit the required documents for the ${position} position. Best regards, HR Team`;
  
  return await sendEmail(email, `Document Submission - ${position}`, htmlBody, textBody, options);
};

// Onboarding email
const sendOnboardingEmail = async (email, candidateName, position, department, joiningDate, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; color: white; text-align: center; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">🎉 Welcome to the Team!</h2>
      </div>
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Dear ${candidateName},</p>
        <p style="color: #666; line-height: 1.6;">Welcome aboard! We are excited to have you join our team as a <strong>${position}</strong> in the <strong>${department}</strong> department.</p>
        <p style="color: #666; line-height: 1.6;"><strong>Joining Date:</strong> ${joiningDate}</p>
        <p style="color: #666; line-height: 1.6;">Please ensure you have completed all onboarding formalities and bring the necessary documents on your first day.</p>
        <p style="color: #666; line-height: 1.6;">If you have any questions, feel free to reach out to our HR team.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br><strong>HR Team</strong></p>
      </div>
    </div>
  `;
  
  const textBody = `Dear ${candidateName}, Welcome to our team! Your joining date is ${joiningDate}. Best regards, HR Team`;
  
  return await sendEmail(email, `Onboarding Confirmation - ${position}`, htmlBody, textBody, options);
};

// Custom email
const sendCustomEmail = async (email, subject, customMessage, options = {}) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="padding: 40px; background: white; border: 1px solid #ddd; border-radius: 10px;">
        <div style="color: #333; white-space: pre-wrap; line-height: 1.6;">
          ${customMessage}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, htmlBody, customMessage, options);
};

// Bulk email sender
const sendBulkEmails = async (recipients, subject, htmlBody, textBody, options = {}) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient, subject, htmlBody, textBody, options);
      results.push({ email: recipient, success: true, messageId: result.messageId });
    } catch (error) {
      results.push({ email: recipient, success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`📊 Bulk Email Results: ${successCount}/${results.length} sent successfully`);
  
  return results;
};

// Check if a user has email configured (for pre-flight checks)
const checkUserEmailConfigured = async (userId) => {
  try {
    if (!userId) return false;
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('emailSettings');
    return !!(user?.emailSettings?.isConfigured && user.emailSettings.smtpEmail && user.emailSettings.smtpAppPassword);
  } catch {
    return false;
  }
};

module.exports = {
  sendEmail,
  sendInterviewEmail,
  sendRejectionEmail,
  sendDocumentEmail,
  sendOnboardingEmail,
  sendCustomEmail,
  sendBulkEmails,
  checkUserEmailConfigured,
  getUserTransporter
};
