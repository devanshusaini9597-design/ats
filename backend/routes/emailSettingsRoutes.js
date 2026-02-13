const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// ─── GET email settings for logged-in user ───
router.get('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('emailSettings email name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Return settings but mask the app password
    const settings = user.emailSettings || {};
    res.json({
      success: true,
      settings: {
        smtpEmail: settings.smtpEmail || '',
        smtpAppPassword: settings.smtpAppPassword ? '••••••••••••••••' : '',
        smtpProvider: settings.smtpProvider || 'gmail',
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || 587,
        isConfigured: settings.isConfigured || false,
        hasPassword: !!settings.smtpAppPassword
      },
      userEmail: user.email,
      userName: user.name
    });
  } catch (err) {
    console.error('Get email settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SAVE email settings ───
router.put('/', async (req, res) => {
  try {
    const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = req.body;

    if (!smtpEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Update settings
    user.emailSettings = {
      smtpEmail: smtpEmail.trim(),
      smtpAppPassword: smtpAppPassword === '••••••••••••••••' 
        ? (user.emailSettings?.smtpAppPassword || '') 
        : smtpAppPassword,
      smtpProvider: smtpProvider || 'gmail',
      smtpHost: smtpHost || '',
      smtpPort: smtpPort || 587,
      isConfigured: true
    };

    await user.save();

    res.json({
      success: true,
      message: 'Email settings saved successfully',
      settings: {
        smtpEmail: user.emailSettings.smtpEmail,
        smtpAppPassword: '••••••••••••••••',
        smtpProvider: user.emailSettings.smtpProvider,
        smtpHost: user.emailSettings.smtpHost,
        smtpPort: user.emailSettings.smtpPort,
        isConfigured: true,
        hasPassword: true
      }
    });
  } catch (err) {
    console.error('Save email settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TEST email settings ───
router.post('/test', async (req, res) => {
  try {
    const { smtpEmail, smtpAppPassword, smtpProvider, smtpHost, smtpPort } = req.body;

    if (!smtpEmail || !smtpAppPassword) {
      return res.status(400).json({ success: false, message: 'Email and App Password are required' });
    }

    // If masked password, fetch from DB
    let actualPassword = smtpAppPassword;
    if (smtpAppPassword === '••••••••••••••••') {
      const User = mongoose.model('User');
      const user = await User.findById(req.user.id);
      actualPassword = user?.emailSettings?.smtpAppPassword;
      if (!actualPassword) {
        return res.status(400).json({ success: false, message: 'No saved password found. Please enter your App Password.' });
      }
    }

    // Create test transporter based on provider
    let testTransporter;
    const serviceProviders = { gmail: 'gmail', yahoo: 'Yahoo', outlook: 'Outlook365' };
    const hostProviders = {
      zoho:      { host: 'smtp.zoho.com',            port: 587 },
      hostinger: { host: 'smtp.hostinger.com',        port: 587 },
      godaddy:   { host: 'smtpout.secureserver.net',  port: 465 },
      namecheap: { host: 'mail.privateemail.com',     port: 587 },
    };
    const provider = smtpProvider || 'gmail';

    if (serviceProviders[provider]) {
      testTransporter = nodemailer.createTransport({
        service: serviceProviders[provider],
        auth: { user: smtpEmail, pass: actualPassword }
      });
    } else if (hostProviders[provider]) {
      const hp = hostProviders[provider];
      testTransporter = nodemailer.createTransport({
        host: hp.host,
        port: hp.port,
        secure: hp.port === 465,
        auth: { user: smtpEmail, pass: actualPassword }
      });
    } else {
      const port = smtpPort || 587;
      testTransporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: port,
        secure: port === 465,
        auth: { user: smtpEmail, pass: actualPassword }
      });
    }

    // Verify connection
    await testTransporter.verify();

    // Send test email to self
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    
    await testTransporter.sendMail({
      from: `"${user?.name || 'Skillnix'}" <${smtpEmail}>`,
      to: smtpEmail,
      subject: '✅ Skillnix Email Settings — Test Successful',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="height: 4px; background: linear-gradient(90deg, #4f46e5, #7c3aed);"></div>
          <div style="padding: 32px; text-align: center;">
            <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">✅</span>
            </div>
            <h2 style="margin: 0 0 8px; font-size: 18px; color: #1f2937;">Email Configuration Verified</h2>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Your email settings are working correctly. All emails will now be sent from this address.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; text-align: left;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Configured Email</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${smtpEmail}</p>
            </div>
          </div>
          <div style="padding: 16px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af;">Skillnix Recruitment Services</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: `Test email sent to ${smtpEmail}. Check your inbox!` });
  } catch (err) {
    console.error('Test email settings error:', err);
    let msg = err.message;
    if (msg.includes('Invalid login') || msg.includes('AUTHENTICATIONFAILED')) {
      msg = 'Authentication failed. Check your email and App Password. Make sure you use a Google App Password, not your regular password.';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      msg = 'Cannot connect to mail server. Check your SMTP settings.';
    }
    res.status(400).json({ success: false, message: msg });
  }
});

// ─── REMOVE email settings (reset to global) ───
router.delete('/', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.emailSettings = {
      smtpEmail: '',
      smtpAppPassword: '',
      smtpProvider: 'gmail',
      smtpHost: '',
      smtpPort: 587,
      isConfigured: false
    };
    await user.save();

    res.json({ success: true, message: 'Email settings removed. System will use default email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
