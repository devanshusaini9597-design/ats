const express = require('express');
const router = express.Router();
const EmailTemplate = require('../models/EmailTemplate');

// ─── GET all templates for the logged-in user (includes defaults) ───
router.get('/', async (req, res) => {
  try {
    const templates = await EmailTemplate.find({
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    }).sort({ isDefault: -1, updatedAt: -1 });
    res.json({ success: true, templates });
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET single template ───
router.get('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CREATE template ───
router.post('/', async (req, res) => {
  try {
    const { name, category, subject, body, variables } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ success: false, message: 'Name, subject and body are required' });
    }
    const template = await EmailTemplate.create({
      name, category: category || 'custom', subject, body,
      variables: variables || [],
      createdBy: req.user.id,
      isDefault: false
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPDATE template ───
router.put('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or not editable' });
    const { name, category, subject, body, variables } = req.body;
    if (name) template.name = name;
    if (category) template.category = category;
    if (subject) template.subject = subject;
    if (body) template.body = body;
    if (variables) template.variables = variables;
    await template.save();
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE template ───
router.delete('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id, isDefault: false });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or cannot be deleted' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEND email using template ───
router.post('/send', async (req, res) => {
  try {
    const { templateId, recipients, variables, cc, bcc, channel } = req.body;
    // channel: 'transactional' (default, ZeptoMail) or 'marketing' (Zoho Campaigns)

    if (!templateId) return res.status(400).json({ success: false, message: 'Template ID is required' });
    
    const template = await EmailTemplate.findOne({
      _id: templateId,
      $or: [{ createdBy: req.user.id }, { isDefault: true }]
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const recipientList = Array.isArray(recipients) ? recipients : [recipients];
    if (!recipientList.length || !recipientList[0]?.email) {
      return res.status(400).json({ success: false, message: 'At least one recipient email is required' });
    }

    const isMarketing = channel === 'marketing';

    if (isMarketing) {
      const { sendMarketingEmail, isCampaignsConfigured } = require('../services/campaignService');
      if (!isCampaignsConfigured()) {
        return res.status(400).json({ success: false, message: 'CAMPAIGNS_NOT_CONFIGURED', displayMessage: 'Zoho Campaigns is not configured.' });
      }
    }

    const { sendEmail, checkUserEmailConfigured } = require('../services/emailService');

    if (!isMarketing) {
      const isConfigured = await checkUserEmailConfigured(req.user.id);
      if (!isConfigured) {
        return res.status(400).json({
          success: false,
          message: 'EMAIL_NOT_CONFIGURED',
          displayMessage: 'Please configure your email settings first. Go to Email → Email Settings to set up your email address.'
        });
      }
    }
    
    const results = { success: [], failed: [] };

    for (const recipient of recipientList) {
      try {
        // Replace variables in subject and body
        const vars = { ...variables, candidateName: recipient.name || variables?.candidateName || 'Candidate' };
        let emailSubject = template.subject;
        let emailBody = template.body;

        Object.entries(vars).forEach(([key, val]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          emailSubject = emailSubject.replace(regex, val || '');
          emailBody = emailBody.replace(regex, val || '');
        });

        // Build professional enterprise HTML email
        const senderName = req.user.name || 'HR Team';
        const senderEmail = req.user.email || '';
        const currentYear = new Date().getFullYear();

        // Parse body into structured content blocks
        const bodyLines = emailBody.split('\n');
        let htmlContent = '';
        let inList = false;

        bodyLines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += '<div style="height: 12px;"></div>';
          } else if (/^(\d+[\.\)]|[-•●])\s/.test(trimmed)) {
            // Numbered or bulleted list item
            if (!inList) { htmlContent += '<ul style="margin: 8px 0 8px 4px; padding-left: 20px; color: #374151;">'; inList = true; }
            htmlContent += `<li style="margin: 4px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed.replace(/^(\d+[\.\)]|[-•●])\s*/, '')}</li>`;
          } else if (trimmed.startsWith('Dear ')) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<p style="margin: 0 0 4px 0; font-size: 15px; color: #1f2937; font-weight: 500;">${trimmed}</p>`;
          } else if (/^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(trimmed)) {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;"><p style="margin: 0 0 2px 0; font-size: 14px; color: #6b7280;">${trimmed}</p>`;
          } else if (idx > 0 && /^(Best regards|Regards|Sincerely|Thank you|Warm regards)/i.test(bodyLines.slice(0, idx).reverse().find(l => l.trim())?.trim() || '')) {
            // Lines after sign-off (like "HR Team", "Skillnix...")
            htmlContent += `<p style="margin: 0 0 1px 0; font-size: 14px; color: #4b5563; font-weight: 600;">${trimmed}</p>`;
          } else if (/^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed)) {
            // Key-value lines like "CTC: 4 LPA", "Date: 15 Feb 2026"
            if (inList) { htmlContent += '</ul>'; inList = false; }
            const colonIdx = trimmed.indexOf(':');
            const key = trimmed.substring(0, colonIdx);
            const val = trimmed.substring(colonIdx + 1).trim();
            htmlContent += `<div style="display: flex; margin: 6px 0; font-size: 14px; line-height: 1.6;"><span style="color: #6b7280; min-width: 160px; font-weight: 500;">${key}:</span><span style="color: #1f2937; font-weight: 600;">${val}</span></div>`;
          } else {
            if (inList) { htmlContent += '</ul>'; inList = false; }
            htmlContent += `<p style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.7; color: #374151;">${trimmed}</p>`;
          }
        });
        if (inList) htmlContent += '</ul>';
        // Close sign-off div if opened
        if (htmlContent.includes('border-top: 1px solid #e5e7eb')) htmlContent += '</div>';

        const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <!-- Logo / Company Header -->
        <tr><td style="padding: 0 0 24px 0; text-align: center;">
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #312e81; letter-spacing: -0.3px;">Skillnix Recruitment Services</p>
        </td></tr>
        <!-- Main Card -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
            <!-- Accent Bar -->
            <tr><td style="height: 4px; background: linear-gradient(90deg, #4f46e5, #7c3aed, #4f46e5); font-size: 0; line-height: 0;">&nbsp;</td></tr>
            <!-- Subject Banner -->
            <tr><td style="padding: 28px 36px 20px 36px; border-bottom: 1px solid #f3f4f6;">
              <h1 style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937; line-height: 1.4;">${emailSubject}</h1>
            </td></tr>
            <!-- Body Content -->
            <tr><td style="padding: 28px 36px 32px 36px;">
              ${htmlContent}
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding: 24px 0 0 0; text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Sent by <strong>${senderName}</strong>${senderEmail ? ' &middot; ' + senderEmail : ''}</p>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #9ca3af;">Skillnix Recruitment Services</p>
          <p style="margin: 0; font-size: 10px; color: #d1d5db;">&copy; ${currentYear} Skillnix. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const emailOptions = { senderName, senderEmail, userId: req.user.id };
        if (cc) emailOptions.cc = Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim()).filter(Boolean);
        if (bcc) emailOptions.bcc = Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim()).filter(Boolean);

        if (isMarketing) {
          const { sendMarketingEmail } = require('../services/campaignService');
          await sendMarketingEmail(recipient.email, emailSubject, htmlBody, { userId: req.user.id, senderName });
        } else {
          await sendEmail(recipient.email, emailSubject, htmlBody, emailBody.replace(/<[^>]*>/g, ''), emailOptions);
        }
        results.success.push(recipient.email);
      } catch (err) {
        if (err.code === 'USE_VERIFIED_DOMAIN') throw err;
        console.error('[Send email] Failed for', recipient.email, ':', err.message, err.code || '');
        results.failed.push({ email: recipient.email, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Sent ${results.success.length} of ${recipientList.length} emails`,
      data: results
    });
  } catch (err) {
    if (err.code === 'USE_VERIFIED_DOMAIN') {
      return res.status(400).json({ success: false, message: err.message, code: 'USE_VERIFIED_DOMAIN' });
    }
    console.error('[Send email] Template send error:', err.message, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEED default templates (called once) ───
router.post('/seed-defaults', async (req, res) => {
  try {
    const existing = await EmailTemplate.countDocuments({ isDefault: true });
    if (existing > 0) return res.json({ success: true, message: 'Default templates already exist', count: existing });

    const defaults = [
      {
        name: 'Hiring Drive Invitation',
        category: 'hiring',
        subject: 'Hiring Drive – {{position}} | {{company}}',
        body: `Dear Candidate,

Greetings!

We are hiring for the profile of {{position}} with {{company}}.

CTC: {{ctc}}
Experience Required: {{experience}}
Location: {{location}}

If you are interested, we have an interview drive scheduled on {{date}} and timings {{time}}.

Kindly reply to this email to confirm your availability.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['position', 'company', 'ctc', 'experience', 'location', 'date', 'time'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Interview Schedule',
        category: 'interview',
        subject: 'Interview Schedule – {{position}} | {{company}}',
        body: `Dear {{candidateName}},

Greetings!

We have an upcoming interview drive for the profile of {{position}} with {{company}}. Your interview has been scheduled as per the details below:

Date: {{date}}
Time: {{time}}

Interview Location:
{{venue}}

SPOC: {{spoc}}
Reference: Skillnix Recruitment Services

Kindly ensure your availability and carry all relevant documents for the interview.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Application Rejection',
        category: 'rejection',
        subject: 'Application Status Update – {{position}}',
        body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} position at {{company}}. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current requirements.

We genuinely appreciate the time and effort you invested in your application. We encourage you to apply for future openings that align with your skills and experience.

We wish you the very best in your career.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Document Request',
        category: 'document',
        subject: 'Document Submission Required – {{position}}',
        body: `Dear {{candidateName}},

Congratulations on progressing to the next stage for the {{position}} position at {{company}}!

As the next step in our hiring process, we kindly request you to submit the following documents:

1. Updated Resume / CV
2. Valid Government-issued Photo ID
3. Educational Certificates & Mark Sheets
4. Previous Employment / Experience Letters
5. Last 3 months Salary Slips (if applicable)

Please reply to this email with the above documents within 3 business days.

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company'],
        isDefault: true,
        createdBy: req.user.id
      },
      {
        name: 'Onboarding Welcome',
        category: 'onboarding',
        subject: 'Welcome Aboard – {{position}} | {{company}}',
        body: `Dear {{candidateName}},

Welcome aboard! We are thrilled to have you join our team as {{position}} at {{company}}.

Joining Date: {{date}}
Reporting Time: {{time}}
Location: {{venue}}

Please ensure you have completed all onboarding formalities and carry the following on your first day:
- Original ID Proof
- Educational Certificates
- Joining Letter (if received)
- 2 Passport-sized Photographs

If you have any questions before your start date, feel free to reach out to us.

We look forward to working with you!

Best regards,
HR Team
Skillnix Recruitment Services`,
        variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue'],
        isDefault: true,
        createdBy: req.user.id
      }
    ];

    await EmailTemplate.insertMany(defaults);
    res.json({ success: true, message: `${defaults.length} default templates created` });
  } catch (err) {
    console.error('Seed templates error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
