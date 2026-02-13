const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

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
      }
    });
  } else {
    defaultTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  console.log('📧 Email Service Initialized:', {
    provider: emailProvider,
    fromEmail: process.env.FROM_EMAIL || process.env.GMAIL_EMAIL
  });
};

initializeTransporter();

// ─── Get per-user transporter (NO global fallback) ───
const getUserTransporter = async (userId) => {
  try {
    if (!userId) return { transporter: null, fromEmail: null, userName: '', configured: false };
    
    const User = mongoose.model('User');
    const user = await User.findById(userId).select('emailSettings name email');
    
    if (!user?.emailSettings?.isConfigured || !user.emailSettings.smtpEmail || !user.emailSettings.smtpAppPassword) {
      return { transporter: null, fromEmail: null, userName: user?.name || '', configured: false };
    }

    const s = user.emailSettings;
    let userTransporter;
    
    // Known providers with service shortcuts
    const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
    // Known providers with explicit SMTP host
    const hostProviders = {
      zoho:      { host: 'smtp.zoho.com',            port: 587 },
      hostinger: { host: 'smtp.hostinger.com',        port: 587 },
      godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
      namecheap: { host: 'mail.privateemail.com',     port: 587 },
    };

    const provider = s.smtpProvider || 'gmail';

    if (serviceProviders[provider]) {
      userTransporter = nodemailer.createTransport({
        service: serviceProviders[provider],
        auth: { user: s.smtpEmail, pass: s.smtpAppPassword }
      });
    } else if (hostProviders[provider]) {
      const hp = hostProviders[provider];
      userTransporter = nodemailer.createTransport({
        host: hp.host,
        port: hp.port,
        secure: hp.port === 465,
        auth: { user: s.smtpEmail, pass: s.smtpAppPassword }
      });
    } else {
      // Custom SMTP
      const port = s.smtpPort || 587;
      userTransporter = nodemailer.createTransport({
        host: s.smtpHost,
        port: port,
        secure: port === 465,
        auth: { user: s.smtpEmail, pass: s.smtpAppPassword }
      });
    }

    return { transporter: userTransporter, fromEmail: s.smtpEmail, userName: user.name || '', configured: true };
  } catch (err) {
    console.error('getUserTransporter error:', err.message);
    return { transporter: null, fromEmail: null, userName: '', configured: false };
  }
};

// Generic email sender — uses per-user transporter if userId provided
const sendEmail = async (to, subject, htmlBody, textBody, options = {}) => {
  const { cc, bcc, senderName, senderEmail, userId } = options;
  
  // Get the right transporter (user-specific only — no global fallback)
  const { transporter: activeTransporter, fromEmail, userName, configured } = await getUserTransporter(userId);
  
  if (!configured || !activeTransporter) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  
  // Build "from" with display name
  const displayName = senderName || userName || '';
  const fromAddress = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  
  const mailOptions = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlBody,
    text: textBody || subject
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
