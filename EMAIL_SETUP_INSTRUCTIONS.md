# 📧 Email Setup Instructions - Nodemailer with Gmail

## ✅ What Was Done

1. **Replaced AWS SES** with **Nodemailer** (simple, no complicated credentials)
2. **Added Gmail SMTP Support** (easiest option)
3. **Added BCC/CC Support** - Send copies to multiple recipients
4. **Updated Frontend** - New CC/BCC input fields in email modal
5. **Updated Backend Routes** - Now accept cc and bcc parameters

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Enable Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Turn ON **2-Step Verification** (if not already enabled)
3. Search for **App Passwords** in the search bar
4. Select **Mail** and **Windows Computer** (or your device)
5. Google will generate a **16-character password**
6. Copy this password (you'll need it in 30 seconds)

### Step 2: Update .env File

Open `backend/.env` and update these lines:

```env
# EMAIL SERVICE SETUP
EMAIL_PROVIDER=gmail
GMAIL_EMAIL=your-gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_EMAIL=your-gmail@gmail.com
```

**🔴 IMPORTANT:** Use the 16-character **App Password**, NOT your regular Gmail password!

### Step 3: Restart Backend Server

```bash
cd backend
npm start
# or
npm run dev
```

You should see in console:
```
✅ Email Service Initialized: provider: gmail, fromEmail: your-gmail@gmail.com
```

---

## ✅ Test Email Sending

### Method 1: Using Frontend UI
1. Open `http://localhost:5173`
2. Go to **All Candidates** page
3. Click **email icon** on any candidate row
4. Select **Interview Invitation**
5. (Optional) Add CC/BCC emails: `test@example.com, another@example.com`
6. Click **Send Email**
7. Check if you receive email ✅

### Method 2: Using Terminal (Advanced)
```bash
curl -X POST http://localhost:5000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

---

## 📋 CC/BCC Features

### In Email Modal
- **CC Field**: Recipients see each other's emails
- **BCC Field**: Recipients don't see other BCC'd emails

### Usage Examples
```
CC: manager@company.com, hr@company.com
BCC: archive@company.com
```

Both fields support comma-separated emails.

---

## 🔧 Alternative: Use Different Email Provider

If you don't want to use Gmail, update `.env`:

```env
# Generic SMTP Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@provider.com
SMTP_PASS=your-password
FROM_EMAIL=noreply@company.com
```

Popular SMTP Servers:
- **Outlook**: smtp.mail.outlook.com (port 587)
- **Yahoo**: smtp.mail.yahoo.com (port 587)
- **SendGrid**: smtp.sendgrid.net (port 587)
- **Custom Server**: Your company's email server

---

## 🐛 Troubleshooting

### Error: "Resolved credential object is not valid"
- **Cause**: Gmail credentials not set in .env
- **Fix**: Make sure GMAIL_EMAIL and GMAIL_APP_PASSWORD are correct

### Error: "Invalid login or disabled less secure app"
- **Cause**: Using regular Gmail password instead of App Password
- **Fix**: Generate a new App Password (16 chars) from Google Account

### Email not received
- **Cause**: Domain reputation or Gmail spam filter
- **Fix**: 
  1. Check email in Spam/Promotions folder
  2. Ask recipient to add sender email to contacts
  3. Wait 5 minutes (Gmail caches)

### Port 587 vs 465
- Port **587**: STARTTLS (recommended for most)
- Port **465**: SMTPS (use with SMTP_SECURE=true)

---

## 📊 Console Logs

When email is sent, you'll see in backend terminal:

```
✅ Email sent to candidate@example.com
   CC: manager@example.com
   BCC: archive@example.com
```

---

## ✅ Email Templates Included

1. **Interview Invitation** - Professional design, purple gradient
2. **Rejection Letter** - Respectful decline message
3. **Document Request** - Lists required documents
4. **Onboarding Welcome** - Joining date & department info
5. **Custom Message** - Plain text support

All templates have:
- Professional HTML formatting
- Responsive design (works on mobile)
- Company branding colors
- Clear call-to-action

---

## 🎯 Next Steps

1. ✅ Update `.env` with gmail credentials
2. ✅ Restart backend server
3. ✅ Test sending an email
4. ✅ Try CC/BCC fields
5. ✅ Send bulk emails (feature already working)

---

**❓ Questions?** Check backend console for detailed error messages!
**🎉 All set!** Email system is now fully functional with BCC/CC support.
