# 🔧 Voice Chat Troubleshooting

## Problem: User List Not Showing / Empty Dropdown

### ✅ Quick Fixes:

1. **Make sure you have TWO users registered**
   - You need at least 2 accounts to see someone in the list
   - Create parent account
   - Create child account
   - Both must be in the same database

2. **Restart the backend server**
   ```bash
   # Stop the server (Ctrl+C)
   # Start again
   node server.js
   ```

3. **Check browser console**
   - Press F12 to open DevTools
   - Go to Console tab
   - Look for messages like:
     ```
     🔍 Loading available users for voice chat...
     ✅ Available users: {...}
     ```

4. **Click the Refresh button (🔄)**
   - In the Voice Chat panel
   - Next to "Call someone:" label
   - This reloads the user list

### 🔍 Debug Steps:

#### Step 1: Check if users exist in database
```bash
# If you have psql installed:
psql parent_child_games

# Then run:
SELECT id, username FROM users;

# You should see at least 2 users
```

#### Step 2: Check backend logs
When you click Voice Chat button, you should see:
```
🔍 User 1 requesting available users
✅ Found 1 available user(s): child_username
```

If you DON'T see this, the request isn't reaching the backend.

#### Step 3: Check API URL
In browser console (F12), check:
```javascript
console.log(process.env.REACT_APP_API_URL || 'http://localhost:5000');
```

Should show your backend URL.

#### Step 4: Test the endpoint directly
Open in browser:
```
http://localhost:5000/api/users/available
```

You should see JSON with error (because no auth) or redirect.

### 🎯 Common Causes:

1. **Only 1 user registered**
   - Solution: Create second account
   - The dropdown filters out YOUR account
   - Need someone else to call!

2. **Backend not running**
   - Solution: Start with `node server.js`
   - Check terminal for errors

3. **Wrong API URL**
   - Check `.env` file has: `REACT_APP_API_URL=http://localhost:5000`
   - Restart frontend after changing .env

4. **CORS issue**
   - Backend should have `app.use(cors());`
   - Check server.js line 10

5. **Auth token issue**
   - Try logging out and logging in again
   - This refreshes your token

### 📊 Expected Behavior:

When you open Voice Chat:

1. **Panel opens** with "Loading..."
2. **Users load** automatically
3. **Dropdown shows**: "Select from X user(s)"
4. **You see usernames** in the list
5. **Can select** and click "Start Call"

### 🐛 Still Not Working?

Try this complete reset:

```bash
# 1. Stop both frontend and backend
# Ctrl+C on both

# 2. Clear browser data
# In browser: Ctrl+Shift+Delete → Clear everything

# 3. Restart backend
node server.js

# 4. Restart frontend
npm start

# 5. Login again
# Register if needed

# 6. Open Voice Chat
# Click refresh button (🔄)
```

### 🔬 Advanced Debugging:

Add this to VoiceChat.jsx after line 51:
```javascript
console.log('Raw data:', data);
console.log('Available users array:', data.users);
console.log('Current user ID:', user.id);
console.log('Filtered users:', filtered);
```

This shows exactly what data you're getting.

### ✨ Success Indicators:

You'll know it's working when:
- ✅ Dropdown says "Select from 1 user(s)" (or more)
- ✅ You can click and see usernames
- ✅ "Start Call" button becomes enabled when you select someone
- ✅ Console shows: "✅ Available users: [...]"

### 📞 Test Call:

Once you see users:
1. Select user from dropdown
2. Click "Start Call"
3. Open second browser/incognito window
4. Login as second user
5. You should see incoming call popup!

---

**Still stuck?** Check these files:
- `server.js` - Lines 666-677 (users/available endpoint)
- `VoiceChat.jsx` - Lines 47-70 (loadAvailableUsers function)
- Browser DevTools Console (F12)
- Backend terminal logs
