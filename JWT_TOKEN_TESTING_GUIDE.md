# JWT Token Testing Guide

## ✅ Token Generated Successfully

**Email**: admin@example.com
**Token**: 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs
```

**Expires**: 16/2/2026 (7 days from generation)

---

## 🧪 Testing Method 1: Browser Console (Frontend)

Open browser DevTools (F12) and run in Console:

```javascript
// Set token in localStorage
localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs');

// Set login flag
localStorage.setItem('isLoggedIn', 'true');
localStorage.setItem('userEmail', 'admin@example.com');

// Verify
console.log(localStorage.getItem('token'));
```

**Then**: Try accessing protected routes:
- http://localhost:5173/ats
- http://localhost:5173/dashboard
- http://localhost:5173/analytics

---

## 🧪 Testing Method 2: cURL Commands (Terminal)

### List all candidates (protected route):
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs" http://localhost:5000/candidates
```

### Get public route (no token needed):
```bash
curl http://localhost:5000/api/daily-task
```

### Try protected route WITHOUT token (should fail):
```bash
curl http://localhost:5000/candidates
```
**Expected Error**: `"Authorization token required"` (401 status)

---

## 🧪 Testing Method 3: Postman

### Step 1: Set up request
1. Create new GET request
2. URL: `http://localhost:5000/candidates`

### Step 2: Add token
- Go to **Headers** tab
- Add header:
  - **Key**: `Authorization`
  - **Value**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs`

### Step 3: Send
- Click **Send**
- **Expected**: ✅ 200 status + candidate data

---

## 🧪 Testing Method 4: Custom Node Script

Create file `test-api.js`:

```javascript
const fetch = require('node-fetch');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzA2MTIxMTgsImV4cCI6MTc3MTIxNjkxOH0.5ZgkHfxI8SiKsTxD3zpMR_Y3dHmppAgvW7CVKVPvaMs';

// Test protected route WITH token
fetch('http://localhost:5000/candidates', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => console.log('✅ WITH TOKEN:', data))
.catch(err => console.error('❌ Error:', err));

// Test protected route WITHOUT token
fetch('http://localhost:5000/candidates')
.then(res => res.json())
.then(data => console.log('❌ WITHOUT TOKEN:', data))
.catch(err => console.error('✅ Expected error:', err));
```

**Run**:
```bash
node test-api.js
```

---

## ✅ Security Tests to Verify

### Test 1: Access Protected Page Without Token
```
❌ BEFORE: Page opens without authentication
✅ AFTER: Redirects to login page
```

### Test 2: API Call Without Token
```bash
curl http://localhost:5000/candidates
```
**Expected Response**:
```json
{
  "message": "Authorization token required"
}
```
**Status**: 401 Unauthorized

### Test 3: API Call With Invalid Token
```bash
curl -H "Authorization: Bearer invalid123" http://localhost:5000/candidates
```
**Expected Response**:
```json
{
  "message": "Invalid or expired token"
}
```
**Status**: 403 Forbidden

### Test 4: API Call With Valid Token
```bash
curl -H "Authorization: Bearer <valid-token>" http://localhost:5000/candidates
```
**Expected**: Returns candidate data, Status 200

### Test 5: Logout Clears Token
1. Login normally
2. Click logout
3. Try to access /dashboard
4. **Expected**: Redirected to login

---

## 📝 How to Generate New Tokens

Run this command anytime to generate a fresh token:

```bash
cd c:\Users\HP\Desktop\allinone\backend
node generate-token.js
```

---

## 🔄 Generate Token with Custom User

Edit `backend/generate-token.js` to use different user:

```javascript
const user = {
  _id: 'custom-user-id-123',
  email: 'newuser@example.com'
};
```

Then run again:
```bash
node generate-token.js
```

---

## 📋 Testing Checklist

- [ ] Backend server running (node server.js)
- [ ] Frontend dev server running (npm run dev)
- [ ] Token in localStorage matches generated token
- [ ] Try accessing /ats without login → redirects to /login ✓
- [ ] Try accessing /ats with token in localStorage → page opens ✓
- [ ] Try API call with token in Authorization header → works ✓
- [ ] Try API call without token → 401 error ✓
- [ ] Logout clears token and redirects to login ✓

---

## 🚨 Important Notes

⚠️ **Token Expiry**: This token expires in 7 days (16/2/2026)
⚠️ **Multiple Tokens**: Each time you run `generate-token.js`, a new token is created
⚠️ **Secret Key**: Change `JWT_SECRET` in production environment
⚠️ **HTTPS**: Always use HTTPS in production for token security

---

## 🎯 Complete Testing Flow

1. **Start Backend**:
   ```bash
   cd backend
   node server.js
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **In Browser Console**:
   ```javascript
   localStorage.setItem('token', '<token-from-above>');
   localStorage.setItem('isLoggedIn', 'true');
   ```

4. **Navigate to Protected Page**:
   - http://localhost:5173/ats
   - Should load successfully ✓

5. **Clear Token and Refresh**:
   ```javascript
   localStorage.clear();
   ```
   - Should redirect to login ✓

---

✅ **Security is now implemented and tested!**
