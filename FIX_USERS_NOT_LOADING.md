# 🔧 Fix "Failed to Load Users" Issue

## The Problem
Voice chat shows "Failed to load users" and dropdown is empty.

## 🎯 Root Cause
**You need at least 2 users in the database!**

The voice chat filters out YOUR account, so:
- 1 user total = 0 available (can't call yourself!)
- 2 users total = 1 available (you can call the other person)
- 3 users total = 2 available (you can call 2 people)

## ✅ Quick Fix Steps

### Step 1: Check How Many Users Exist

**Option A: In Browser**
1. Open: `http://localhost:5000/api/users/all`
2. You'll need to login first, or check backend logs

**Option B: Check Backend Logs**
When you open voice chat, backend should show:
```
🔍 User 1 requesting available users
✅ Found 1 available user(s): child (ID: 2)
```

**Option C: Direct Database Check**
```bash
# Connect to database
psql parent_child_games

# Check users
SELECT id, username FROM users;

# Should show:
#  id | username 
# ----+----------
#   1 | dad
#   2 | child
```

### Step 2: Create Second User (If Needed)

**If you only have 1 user**, create another:

1. **Logout** from current account
2. **Click "Don't have an account? Register"**
3. **Create new account**:
   - Username: `child` (or any name)
   - Password: `test123`
4. **Login** with the new account
5. **Logout** and login as your first account
6. **Open Voice Chat** - should now see the new user!

### Step 3: Verify It Works

1. Login as **User 1** (e.g., "dad")
2. Open **Voice Chat** (🎙️ button)
3. Should show: **"1 user(s) available to call"**
4. Dropdown should have: **"child"** (or whatever username you created)

## 🔍 Detailed Debugging

### Check 1: Backend is Running
```bash
# You should see this in terminal:
🚀 Server: http://localhost:5000
✅ Database tables initialized
```

### Check 2: Frontend Can Reach Backend
Open browser console (F12), look for:
```
🔍 Loading available users for voice chat...
API URL: http://localhost:5000
Response status: 200
Response OK: true
```

If status is **401** or **403**:
- Authentication issue
- Try logging out and back in

If status is **500**:
- Backend error
- Check backend terminal for errors

If **Network Error**:
- Backend not running
- Wrong API_URL in `.env`

### Check 3: Response Data
In console, you should see:
```javascript
✅ API Response: {users: Array(1)}
  users: [
    {id: 2, username: "child"}
  ]
```

If you see `{users: []}` (empty array):
- Only 1 user in database
- Need to create more accounts

### Check 4: Database Has Users
```bash
# Method 1: Using psql
psql parent_child_games -c "SELECT COUNT(*) FROM users;"

# Should show at least 2

# Method 2: Check in detail
psql parent_child_games -c "SELECT id, username, created_at FROM users;"
```

## 🛠️ Common Issues & Fixes

### Issue 1: "No other users registered"
**Cause**: Only 1 user exists
**Fix**: Create second account (see Step 2 above)

### Issue 2: "Failed to load users (401)"
**Cause**: Not authenticated
**Fix**: 
1. Logout
2. Login again
3. Try voice chat

### Issue 3: "Failed to load users (500)"
**Cause**: Database error
**Fix**:
1. Check backend logs for error details
2. Restart backend: `node server.js`
3. Check database is running: `psql parent_child_games`

### Issue 4: "Error: Failed to fetch"
**Cause**: Backend not running or wrong URL
**Fix**:
1. Start backend: `node server.js`
2. Check `.env` has: `REACT_APP_API_URL=http://localhost:5000`
3. Restart frontend after changing .env

## 🧪 Testing Script

Run this in your browser console (F12):

```javascript
// Test 1: Check API URL
console.log('API URL:', process.env.REACT_APP_API_URL || 'http://localhost:5000');

// Test 2: Check auth token
console.log('Has token:', !!localStorage.getItem('game_token'));

// Test 3: Manual API call
fetch('http://localhost:5000/api/users/available', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('game_token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Users:', data))
.catch(err => console.error('Error:', err));
```

Expected output:
```
API URL: http://localhost:5000
Has token: true
Users: {users: Array(1)}
```

## 📋 Quick Checklist

Before voice chat will work:
- [ ] Backend running (`node server.js`)
- [ ] Frontend running (`npm start`)
- [ ] Database has `users` table
- [ ] **At least 2 users registered**
- [ ] Logged in successfully
- [ ] No errors in browser console
- [ ] No errors in backend terminal

## 🎯 Expected Flow

### Correct Setup:
```
1. Database has 2 users:
   - dad (ID: 1)
   - child (ID: 2)

2. Login as "dad"

3. Open Voice Chat

4. Backend logs:
   🔍 User 1 requesting available users
   ✅ Found 1 available user(s): child (ID: 2)

5. Frontend logs:
   ✅ API Response: {users: [{id: 2, username: "child"}]}
   ✅ 1 user(s) loaded: child

6. Dropdown shows:
   "Select from 1 user(s)"
   - child
```

## 🚀 Create Test Users Easily

### Quick Script to Create Users:

If you have `psql` access:

```sql
-- Connect to database
\c parent_child_games

-- Create first user (if doesn't exist)
INSERT INTO users (username, password, coins)
VALUES ('dad', 'test123', 100)
ON CONFLICT (username) DO NOTHING;

-- Create second user
INSERT INTO users (username, password, coins)
VALUES ('child', 'test123', 100)
ON CONFLICT (username) DO NOTHING;

-- Create third user (optional)
INSERT INTO users (username, password, coins)
VALUES ('mom', 'test123', 100)
ON CONFLICT (username) DO NOTHING;

-- Check users
SELECT id, username, coins FROM users;
```

### Or Create Through UI:
1. Logout
2. Click "Register"
3. Create account (username: child, password: test123)
4. Logout
5. Login as your main account
6. Try voice chat again

## ✨ Success Indicators

You'll know it's working when:

### In Browser:
```
Voice Chat Panel:
┌─────────────────────────┐
│ 🎙️ Voice Chat          │
├─────────────────────────┤
│ 1 user(s) available to  │
│ call                    │
│                         │
│ Call someone:      🔄   │
│ ┌─────────────────────┐ │
│ │ Select from 1 user(s)│ │
│ │ child              ▼ │ │
│ └─────────────────────┘ │
│                         │
│ [📞 Start Call]         │
└─────────────────────────┘
```

### In Console:
```
🔍 Loading available users for voice chat...
✅ API Response: {users: Array(1)}
✅ 1 user(s) loaded: child
```

### In Backend:
```
🔍 User 1 requesting available users
   Username: dad
✅ Found 1 available user(s): child (ID: 2)
```

## 🆘 Still Not Working?

1. **Delete everything and start fresh**:
```bash
# Drop database
dropdb parent_child_games

# Create new database
createdb parent_child_games

# Restart backend (creates tables)
node server.js

# Register 2 accounts through UI
# Try voice chat
```

2. **Check this specific log sequence**:
   - Backend: "Found X available user(s)"
   - Frontend: "API Response: {users: Array(X)}"
   - Frontend: "X user(s) loaded"

If ANY of these is missing or shows 0, that's where the problem is!

---

**Most Common Fix**: Just create a second user account! 👥
