# 🧪 Step-by-Step Testing Guide

## ✅ Verify Security is Working

### Test 1: Access Protected Page WITHOUT Authentication ❌

**Goal**: Verify that `/ats` page redirects to login

**Steps**:
1. Open **NEW private/incognito window** (important!)
2. Go to: `http://localhost:5173/ats`
3. **Expected Result**: ❌ Should redirect to `/login` page automatically

**What's Happening**:
- ProtectedRoute checks localStorage for token
- No token found → Redirects to /login
- ✅ **SECURITY WORKING!**

---

### Test 2: Access Protected Page WITH Authentication ✅

**Goal**: Verify that `/ats` page opens with valid token

**Steps**:

1. **Generate Token**:
   ```bash
   cd c:\Users\HP\Desktop\allinone\backend
   node generate-token.js
   ```
   Copy the long token string (eyJhbGciOiJIUzI1NiIs...)

2. **Open Browser DevTools** (F12)

3. **Click on Console tab**

4. **Paste this code**:
   ```javascript
   localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs');
   localStorage.setItem('isLoggedIn', 'true');
   localStorage.setItem('userEmail', 'admin@example.com');
   console.log('✅ Token Set! Check localStorage');
   ```

5. **Press Enter**

6. **Navigate to**: `http://localhost:5173/ats`

7. **Expected Result**: ✅ Should load ATS dashboard

**What's Happening**:
- localStorage now has valid JWT token
- ProtectedRoute finds token → Doesn't redirect
- Component renders successfully
- ✅ **AUTHENTICATION WORKING!**

---

### Test 3: API Call WITHOUT Token ❌

**Goal**: Verify that API calls without token fail

**Steps**:

1. **Open Terminal**

2. **Run this command**:
   ```bash
   curl http://localhost:5000/candidates
   ```

3. **Expected Response**:
   ```json
   {
     "message": "Authorization token required"
   }
   ```

4. **Expected Status**: `401 Unauthorized`

**What's Happening**:
- API request has no Authorization header
- Backend middleware checks for token
- Token not found → Returns 401 error
- ✅ **API PROTECTION WORKING!**

---

### Test 4: API Call WITH Valid Token ✅

**Goal**: Verify that API works with valid token

**Steps**:

1. **Copy your token** from Test 2

2. **Run this command in Terminal**:
   ```bash
   curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs" http://localhost:5000/candidates
   ```

3. **Expected Response**: 
   - Status: `200 OK`
   - Returns array of candidates
   ```json
   [
     {
       "_id": "...",
       "name": "...",
       "email": "...",
       ...
     }
   ]
   ```

**What's Happening**:
- Authorization header includes Bearer token
- Backend verifies token signature
- Token is valid → API proceeds
- Returns candidate data
- ✅ **AUTHENTICATED API WORKING!**

---

### Test 5: API Call WITH Invalid Token ❌

**Goal**: Verify that invalid tokens are rejected

**Steps**:

1. **Run this command**:
   ```bash
   curl -H "Authorization: Bearer invalid123notareatoken" http://localhost:5000/candidates
   ```

2. **Expected Response**:
   ```json
   {
     "message": "Invalid or expired token"
   }
   ```

3. **Expected Status**: `403 Forbidden`

**What's Happening**:
- Authorization header has fake token
- Backend tries to verify signature
- Signature doesn't match → Rejects token
- ✅ **TOKEN VALIDATION WORKING!**

---

### Test 6: Logout Clears Token ❌

**Goal**: Verify that logout removes authentication

**Steps**:

1. **Set token** (from Test 2)

2. **Verify you can see ATS**: `http://localhost:5173/ats`
   - Should load successfully

3. **Open DevTools Console**

4. **Clear localStorage**:
   ```javascript
   localStorage.clear();
   console.log('✅ localStorage cleared');
   ```

5. **Refresh page** (F5)

6. **Expected Result**: ❌ Should redirect to login

**What's Happening**:
- Token removed from localStorage
- ProtectedRoute finds no token
- User redirected to login page
- ✅ **LOGOUT WORKING!**

---

### Test 7: All Protected Routes Work

**Goal**: Verify all protected routes are actually protected

**Steps**:

1. **Clear localStorage** (from Test 6)

2. **Try each route in incognito window**:
   ```
   ❌ http://localhost:5173/ats
   ❌ http://localhost:5173/dashboard
   ❌ http://localhost:5173/analytics
   ❌ http://localhost:5173/recruitment
   ❌ http://localhost:5173/jobs
   ❌ http://localhost:5173/candidate-search
   ❌ http://localhost:5173/homeunder
   ```

3. **Expected**: All should redirect to `/login`

4. **Set token again** (from Test 2)

5. **Try each route again**:
   ```
   ✅ http://localhost:5173/ats
   ✅ http://localhost:5173/dashboard
   ✅ http://localhost:5173/analytics
   ✅ http://localhost:5173/recruitment
   ✅ http://localhost:5173/jobs
   ✅ http://localhost:5173/candidate-search
   ✅ http://localhost:5173/homeunder
   ```

6. **Expected**: All should load successfully

**What's Happening**:
- Each route is wrapped with ProtectedRoute
- Without token → All redirected to login
- With token → All accessible
- ✅ **ALL ROUTES PROTECTED!**

---

### Test 8: Public Routes Work WITHOUT Token ✅

**Goal**: Verify that public routes don't need authentication

**Steps**:

1. **Clear localStorage**

2. **Try public routes**:
   ```bash
   # Test in new incognito window
   curl http://localhost:5000/api/daily-task
   curl http://localhost:5000/api/home-updates
   ```

3. **Expected**: 
   - Status: `200 OK`
   - Returns data without requiring token

**What's Happening**:
- These routes don't have verifyToken middleware
- No Authorization header required
- Data returned immediately
- ✅ **PUBLIC ROUTES WORKING!**

---

### Test 9: Session Persists on Refresh ✅

**Goal**: Verify token persists in localStorage

**Steps**:

1. **Set token** (from Test 2)

2. **Navigate to**: `http://localhost:5173/ats`
   - Should load successfully

3. **Press F5** (refresh page)

4. **Expected**: Still on `/ats` page, no redirect

5. **Open DevTools Console**:
   ```javascript
   console.log(localStorage.getItem('token'));
   ```

6. **Expected**: Should show token string

**What's Happening**:
- Token stored in localStorage
- Persists across page refresh
- ProtectedRoute finds token on refresh
- Page stays on same route
- ✅ **SESSION PERSISTENCE WORKING!**

---

### Test 10: Complete Login Flow

**Goal**: Verify complete authentication workflow

**Steps**:

1. **Start fresh** (clear everything)

2. **Go to home page**:
   ```
   http://localhost:5173/
   ```

3. **Should see** login/register buttons

4. **Try to access protected route directly**:
   ```
   http://localhost:5173/ats
   ```

5. **Expected**: Redirects to login

6. **On login page**, try login with credentials:
   - Email: admin@example.com
   - Password: admin123

7. **After successful login** (if using login flow):
   - Token should be saved
   - Should redirect to dashboard
   - Can now access `/ats`, `/analytics`, etc.

**What's Happening**:
- Complete authentication workflow
- Login → Token generation → Route access
- ✅ **COMPLETE FLOW WORKING!**

---

## ✅ Full Test Checklist

Run through all tests to confirm security:

- [ ] Test 1: Page redirects without token ✅
- [ ] Test 2: Page loads with token ✅
- [ ] Test 3: API returns 401 without token ✅
- [ ] Test 4: API returns data with token ✅
- [ ] Test 5: Invalid token returns 403 ✅
- [ ] Test 6: Logout clears token ✅
- [ ] Test 7: All protected routes are protected ✅
- [ ] Test 8: Public routes work without token ✅
- [ ] Test 9: Session persists on refresh ✅
- [ ] Test 10: Complete login flow works ✅

---

## 🎯 Expected Results Summary

| Test | Without Token | With Valid Token | Status |
|------|---|---|---|
| Access /ats | ❌ Redirects to login | ✅ Opens page | PASS |
| Access /dashboard | ❌ Redirects to login | ✅ Opens page | PASS |
| GET /candidates API | ❌ 401 error | ✅ Returns data | PASS |
| POST /candidates API | ❌ 401 error | ✅ Creates record | PASS |
| With invalid token | ❌ 403 error | - | PASS |
| After logout | ❌ Redirects to login | - | PASS |

---

## 🚨 Troubleshooting

### Issue: "Can't access /ats even with token"

**Solution**:
1. Open DevTools
2. Check if token is in localStorage:
   ```javascript
   console.log(localStorage.getItem('token'));
   ```
3. If empty, set it again:
   ```javascript
   localStorage.setItem('token', '<your-token>');
   localStorage.setItem('isLoggedIn', 'true');
   ```

### Issue: "API returns 401 even with token"

**Solution**:
1. Token might be expired
2. Generate new token:
   ```bash
   node generate-token.js
   ```
3. Update localStorage with new token

### Issue: "curl command shows invalid"

**Solution**:
1. Make sure curl is installed
2. Or use Postman instead
3. Or use this Node script:
   ```javascript
   fetch('http://localhost:5000/candidates', {
     headers: { 'Authorization': 'Bearer <token>' }
   }).then(r => r.json()).then(console.log);
   ```

### Issue: "Backend server won't start"

**Solution**:
1. Check if MongoDB is running
2. Check if port 5000 is available
3. Run: `npm install` in backend directory
4. Make sure .env file exists

---

## 🎉 Success Indicators

✅ **Your security is working if:**

1. ❌ Cannot access `/ats` without token
2. ✅ Can access `/ats` with token
3. ❌ Cannot call APIs without token
4. ✅ Can call APIs with token
5. ❌ Invalid tokens are rejected
6. ✅ Token persists on refresh
7. ✅ Logout clears everything
8. ❌ Cannot reuse after logout

---

**When all tests pass, your application is SECURE! 🔐**

For any issues, refer to documentation files:
- `SECURITY_COMPLETE_SUMMARY.md`
- `QUICK_START_AUTH.md`
- `JWT_TOKEN_TESTING_GUIDE.md`
