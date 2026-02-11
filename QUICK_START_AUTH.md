# 🔐 Authentication & Route Protection - QUICK START GUIDE

## ✅ Complete Implementation Done!

Your application now has full JWT-based authentication with protected routes.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Verify Backend is Running
```bash
cd c:\Users\HP\Desktop\allinone\backend
npm start
# or
node server.js
```
**Expected Output**: 
- ✅ MongoDB Connected
- 🚀 Server running on port 5000

---

### Step 2: Generate JWT Token
```bash
# In backend directory
node generate-token.js
```

**Output**:
```
📧 Email: admin@example.com
🔑 Token: eyJhbGciOiJIUzI1NiIs...
✅ Expires: 16/2/2026
```

**Copy the token** (entire long string)

---

### Step 3: Test in Browser Console

Open **Developer Tools** (F12) in your browser and paste:

```javascript
// Copy this entire code and paste in console
localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs');
localStorage.setItem('isLoggedIn', 'true');
localStorage.setItem('userEmail', 'admin@example.com');
console.log('✅ Token set! Now navigate to /ats or /dashboard');
```

---

## 🧪 Verify Security is Working

### Test 1: Access Protected Page WITHOUT Token
1. Open private/incognito browser window
2. Go to: `http://localhost:5173/ats`
3. **Expected**: ❌ Redirects to login page ✓

### Test 2: Access Protected Page WITH Token
1. Set token (Step 3 above)
2. Go to: `http://localhost:5173/ats`
3. **Expected**: ✅ Dashboard opens successfully ✓

### Test 3: API Call Without Token
```bash
curl http://localhost:5000/candidates
```
**Expected Response**:
```json
{
  "message": "Authorization token required"
}
```
**Status**: 401 ✓

### Test 4: API Call With Token
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." http://localhost:5000/candidates
```
**Expected**: Returns candidate data ✓

---

## 📋 What Was Changed

### Frontend Files
✅ `ProtectedRoute.jsx` - Protects routes from unauthorized access
✅ `App.jsx` - Wraps protected routes
✅ `authUtils.js` - Logout functionality
✅ `fetchUtils.js` - Sends JWT token with API calls
✅ `Dashboard.jsx`, `ATS.jsx`, `CandidateSearch.jsx`, `AnalyticsDashboard.jsx` - Use authenticated fetch

### Backend Files
✅ `middleware/authMiddleware.js` - JWT verification middleware
✅ `server.js` - Protected routes with middleware
✅ `generate-token.js` - Token generation script
✅ `.env` - JWT_SECRET configuration
✅ Installed `jsonwebtoken` package

---

## 🔑 Protected Routes vs Public Routes

### 🔓 Public Routes (No Token Needed)
- `POST /api/login` - User login
- `POST /register` - User registration
- `GET /api/daily-task` - Daily tasks
- `GET /api/home-updates` - Home updates

### 🔐 Protected Routes (Token Required)
- `GET /candidates` - List candidates
- `POST /candidates` - Add candidate
- `GET /api/analytics/*` - Analytics data
- `POST /api/email/*` - Send emails
- `GET /jobs` - List jobs
- `POST /jobs` - Create job

---

## 🎯 Complete Flow

```
User Opens App
    ↓
Try to access /ats (protected)
    ↓
No token in localStorage?
    ↓ YES → Redirect to /login
    ↓ NO
Login with credentials
    ↓
Backend validates → Generate JWT token
    ↓
Token saved in localStorage
    ↓
Redirect to /ats (or dashboard)
    ↓
ProtectedRoute checks token ✓
    ↓
React component renders
    ↓
Component calls API using authenticatedFetch()
    ↓
Token sent in Authorization header
    ↓
Backend verifies token ✓
    ↓
API returns data
```

---

## 💡 Tips for Development

### Generate Token with Custom Email
Edit `backend/generate-token.js`:
```javascript
const user = {
  _id: 'your-custom-id',
  email: 'youremail@example.com'
};
```

Then run:
```bash
node generate-token.js
```

### Change JWT Secret (Recommended for Production)
Edit `.env`:
```
JWT_SECRET=your-super-secret-key-change-this
```

### Token Expiry
Token currently expires in **7 days**. Change in `authMiddleware.js`:
```javascript
{ expiresIn: '7d' }  // Change to '1d', '30d', etc.
```

---

## ⚠️ Common Issues

### Issue: "No token provided"
**Solution**: 
```javascript
// In browser console, set token:
localStorage.setItem('token', '<your-token>');
localStorage.setItem('isLoggedIn', 'true');
```

### Issue: "Invalid or expired token"
**Solution**: Generate a new token:
```bash
node generate-token.js
```

### Issue: API returns 401
**Solution**: 
1. Check token in localStorage
2. Verify Authorization header is sent
3. Token might be expired (generate new one)

### Issue: Routes not protected
**Solution**: Clear browser cache and localStorage:
```javascript
localStorage.clear();
sessionStorage.clear();
```

---

## 📞 Testing Endpoints

### Login (Get Token)
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Get Candidates (Requires Token)
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/candidates
```

### Get Analytics (Requires Token)
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/analytics/dashboard-stats
```

---

## ✅ Security Checklist

- [x] Frontend routes are protected
- [x] Backend API requires JWT token
- [x] Token sent in Authorization header
- [x] Invalid tokens are rejected (401/403)
- [x] Logout clears token
- [x] Token generation script works
- [x] Protected routes redirect to login
- [x] Token includes 7-day expiry
- [x] Environment variable for JWT_SECRET

---

## 🎉 Done!

Your application is now secure! All protected pages require authentication before access.

**Any issues?** Check the `JWT_TOKEN_TESTING_GUIDE.md` for detailed testing instructions.
