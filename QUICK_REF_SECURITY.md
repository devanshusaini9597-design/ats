# 🔐 SECURITY QUICK REFERENCE CARD

## 🚀 Quick Start (Copy & Paste)

### 1. Generate Token
```bash
cd c:\Users\HP\Desktop\allinone\backend
node generate-token.js
```

### 2. Set Token in Browser (Open DevTools F12 → Console)
```javascript
localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs');
localStorage.setItem('isLoggedIn', 'true');
localStorage.setItem('userEmail', 'admin@example.com');
```

### 3. Access Protected Pages
```
http://localhost:5173/ats
http://localhost:5173/dashboard
http://localhost:5173/analytics
```

---

## 🧪 Quick Tests

### Test: No Token → Should Fail ❌
```bash
curl http://localhost:5000/candidates
# Expected: 401 Unauthorized
```

### Test: With Token → Should Work ✅
```bash
curl -H "Authorization: Bearer <your-token>" http://localhost:5000/candidates
# Expected: 200 OK + candidate data
```

### Test: Public Route → Should Work ✅
```bash
curl http://localhost:5000/api/daily-task
# Expected: 200 OK + daily task
```

---

## 📋 Files & Locations

### Frontend Security Files
```
frontend/src/
├── components/
│   ├── ProtectedRoute.jsx ← Route protection
│   ├── App.jsx ← Protected routes config
│   ├── Dashboard.jsx ← Auth API calls
│   ├── ATS.jsx ← Auth API calls
│   ├── CandidateSearch.jsx ← Auth API calls
│   └── AnalyticsDashboard.jsx ← Auth API calls
└── utils/
    ├── authUtils.js ← Logout handler
    └── fetchUtils.js ← Authenticated fetch
```

### Backend Security Files
```
backend/
├── middleware/
│   └── authMiddleware.js ← JWT verification
├── server.js ← Protected route config
├── generate-token.js ← Token generator
└── .env ← JWT_SECRET, MongoDB URL
```

---

## 🔑 Token Info

**Expires**: 7 days from generation
**Format**: `Bearer <jwt-token>`
**Header**: `Authorization: Bearer eyJhbGciOi...`
**Storage**: localStorage
**Payload**: `{ id, email, iat, exp }`

---

## 🔐 Protected vs Public

### Protected Routes (Need Token)
```
GET /candidates
POST /candidates
PUT /candidates/:id
DELETE /candidates/:id
GET /api/analytics/*
POST /api/email/send
POST /api/email/send-bulk
GET /jobs
POST /jobs
```

### Public Routes (No Token)
```
POST /api/login
POST /register
GET /api/daily-task
GET /api/home-updates
GET /diagnostics
GET /seed-candidates
```

---

## 🛠️ Common Commands

### Clear Token
```javascript
localStorage.clear();
```

### Check Token
```javascript
console.log(localStorage.getItem('token'));
```

### Start Backend
```bash
cd backend
npm start
```

### Generate New Token
```bash
cd backend
node generate-token.js
```

### Test API
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/candidates
```

---

## ⚠️ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Access denied to /ats | Set token in localStorage |
| 401 error on API calls | Check token exists & is valid |
| 403 Invalid token error | Generate new token |
| Cannot access /ats even with token | Refresh page (F5) |
| Token not persisting | Check localStorage not cleared |
| Backend won't start | Check MongoDB connection |

---

## 🎯 Test Scenarios

### Scenario 1: First Time User
1. Open new window
2. Try `/ats` → ❌ Redirects to login
3. Set token in console → ✅ Works

### Scenario 2: Logout
1. On `/ats` page
2. Run: `localStorage.clear()`
3. Refresh page → ❌ Redirects to login

### Scenario 3: API Call
1. Without token → 401 error
2. With token → 200 OK + data
3. Invalid token → 403 error

---

## 📊 Implementation Summary

✅ **7 Frontend Routes Protected**
✅ **14 Backend API Endpoints Protected**
✅ **JWT Authentication System**
✅ **Token Validation on Every Request**
✅ **Automatic Redirect on Unauthorized Access**
✅ **Session Persistence**
✅ **Token Expiry (7 days)**
✅ **Public Routes Working**

---

## 🔗 Related Files

📄 `SECURITY_COMPLETE_SUMMARY.md` - Full implementation details
📄 `QUICK_START_AUTH.md` - Detailed quick start
📄 `JWT_TOKEN_TESTING_GUIDE.md` - Comprehensive testing guide
📄 `STEP_BY_STEP_TESTING.md` - Step-by-step tests
📄 `SECURITY_FIX_ROUTES_PROTECTION.md` - Technical details

---

## ✅ Verification Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] Token generated and copied
- [ ] Token set in localStorage
- [ ] Can access `/ats` with token
- [ ] Cannot access `/ats` without token
- [ ] API calls work with token
- [ ] API calls fail without token
- [ ] Logout clears token
- [ ] All routes redirect on unauthorized access

---

**🎉 When everything checks, you're secure!**

For issues, check the detailed documentation files.
