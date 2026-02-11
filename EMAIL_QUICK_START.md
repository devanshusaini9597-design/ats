# ⚡ QUICK START - Get Email Working in 5 Minutes

## 🎯 Your Task - 3 Steps

### Step 1️⃣: Update .env (Copy-Paste Ready)

**File**: `backend/.env`

Change these lines (KEEP EVERYTHING ELSE):

```env
EMAIL_PROVIDER=gmail
GMAIL_EMAIL=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=paste-16-char-app-password-here
FROM_EMAIL=your-gmail-address@gmail.com
```

**To get GMAIL_APP_PASSWORD:**
1. Go to: https://myaccount.google.com/security
2. Turn ON "2-Step Verification" (if off)
3. Search "App Passwords" (top search bar)
4. Select: Mail + Windows Computer
5. Copy the 16-character code
6. Paste (without spaces) into GMAIL_APP_PASSWORD

### Step 2️⃣: Restart Backend Server

```bash
cd backend
npm start
```

**Look for this message:**
```
✅ Email Service Initialized: provider: gmail, fromEmail: your-email@gmail.com
```

### Step 3️⃣: Test in Browser

1. Open: http://localhost:5173
2. Go to: **All Candidates** page
3. Find any candidate
4. Click: **✉️ email icon**
5. Select: **Interview Invitation**
6. Add to CC field: `your-email@gmail.com` (test)
7. Click: **Send Email**
8. Check your inbox ✅

**You should see**: ✅ Email sent successfully

---

## 🧪 WHAT'S NEW

### New Fields in Email Modal:
- 📋 **CC** - Recipients see each other (optional)
- 🔒 **BCC** - Recipients hidden (optional)

**Format**: Comma-separated emails
```
manager@company.com, hr@company.com
```

### Email Templates Working:
- ✅ Interview Invitation
- ✅ Rejection Letter  
- ✅ Document Request
- ✅ Onboarding Welcome
- ✅ Custom Message

---

## ❌ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Invalid credentials"** | Check GMAIL_EMAIL and GMAIL_APP_PASSWORD in .env |
| **Emails to spam** | Ask recipient to add your email to contacts |
| **CC/BCC not working** | Use format: `email@test.com, email2@test.com` |
| **Backend won't start** | Make sure `.env` has valid data, no extra spaces |

---

## 📊 What Was Changed

| File | Change |
|------|--------|
| `backend/services/emailService.js` | ✅ AWS SES → Nodemailer |
| `backend/routes/emailRoutes.js` | ✅ Added CC/BCC support |
| `backend/.env` | ✅ Created (new file) |
| `frontend/ATS.jsx` | ✅ Added CC/BCC input fields |

**All changes validated** ✅
- Backend syntax: Valid ✓
- Frontend build: Success ✓
- Dependencies: Installed ✓

---

## 🚀 NOW DO THIS:

1. **Update .env** with Gmail credentials
2. **Restart backend**: `npm start`
3. **Look for** ✅ in console
4. **Test email** in browser
5. **Check inbox** ✅

---

**Still having issues?**
- Check backend console for error messages
- Verify EMAIL_PROVIDER=gmail in .env
- Make sure 2-Step Verification is ON in Google Account
- Ensure you used App Password (16 chars), not regular password

**Questions?** Read `EMAIL_SETUP_INSTRUCTIONS.md` for detailed guide
