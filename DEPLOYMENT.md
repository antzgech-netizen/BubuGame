# 🌐 Deployment Guide

This guide will help you deploy your Parent-Child Game Platform online so you can play from different countries!

## Option 1: Heroku (Recommended - Free Tier Available)

### Prerequisites
1. Create a [Heroku account](https://signup.heroku.com/)
2. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Install Git if not already installed

### Deploy Backend to Heroku

1. **Initialize Git Repository**:
```bash
cd parent-child-games
git init
git add .
git commit -m "Initial commit"
```

2. **Create Heroku App**:
```bash
heroku login
heroku create your-unique-game-name-backend
```

3. **Add PostgreSQL Database**:
```bash
heroku addons:create heroku-postgresql:mini
```

4. **Set Environment Variables**:
```bash
heroku config:set JWT_SECRET=your-random-secret-key-here
heroku config:set NODE_ENV=production
```

5. **Create Procfile** (in root directory):
```
web: node server.js
```

6. **Deploy**:
```bash
git push heroku main
```

7. **Get your backend URL**:
```bash
heroku open
```
Your backend URL will be something like: `https://your-game-name-backend.herokuapp.com`

### Deploy Frontend to Netlify (Free)

1. **Create Account** at [Netlify](https://www.netlify.com/)

2. **Update .env**:
```
REACT_APP_API_URL=https://your-game-name-backend.herokuapp.com
```

3. **Build the React App**:
```bash
npm run build
```

4. **Deploy to Netlify**:
- Drag and drop the `build` folder to Netlify
- Or connect your GitHub repository for automatic deploys

Your frontend will be at: `https://your-game-name.netlify.app`

## Option 2: Railway (Easier Alternative)

### Deploy Everything to Railway

1. **Create Account** at [Railway.app](https://railway.app/)

2. **Deploy Backend**:
- Click "New Project"
- Select "Deploy from GitHub repo"
- Add PostgreSQL service
- Environment variables will be auto-configured!

3. **Deploy Frontend**:
- Create another service
- Select your frontend
- Add build command: `npm run build`
- Add start command: `npx serve -s build`

## Option 3: Render (Free Tier)

1. **Create Account** at [Render.com](https://render.com/)

2. **Deploy Backend**:
- New Web Service
- Connect GitHub
- Build Command: `npm install`
- Start Command: `node server.js`
- Add PostgreSQL database

3. **Deploy Frontend**:
- New Static Site
- Build Command: `npm run build`
- Publish Directory: `build`

## Option 4: Quick Testing with Ngrok

Perfect for immediate testing without full deployment!

1. **Download** [Ngrok](https://ngrok.com/)

2. **Start Backend Locally**:
```bash
node server.js
```

3. **Start Ngrok** (in new terminal):
```bash
ngrok http 5000
```

4. **Update Frontend .env**:
```
REACT_APP_API_URL=https://your-ngrok-url.ngrok.io
```

5. **Start Frontend**:
```bash
npm start
```

6. **Share the Frontend URL** with your family!

**Note**: Ngrok URLs change when you restart. For permanent solution, use Options 1-3.

## 🔒 Security Checklist

Before going live:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic with Heroku/Netlify)
- [ ] Add password hashing (bcrypt) in production
- [ ] Set up CORS properly in server.js
- [ ] Add rate limiting to prevent abuse

## 📱 Testing on Mobile After Deployment

1. **Get Your URLs**:
   - Backend: `https://your-backend.herokuapp.com`
   - Frontend: `https://your-frontend.netlify.app`

2. **Test on Different Devices**:
   - Open frontend URL on phone/tablet
   - Create accounts
   - Try chat
   - Play games!

## 💡 Tips for Smooth Deployment

1. **Test Locally First**: Make sure everything works on localhost
2. **Check Logs**: Use `heroku logs --tail` to debug issues
3. **Database Reset**: If needed: `heroku pg:reset DATABASE_URL --confirm app-name`
4. **Environment Variables**: Double-check all env vars are set correctly

## 🆘 Common Issues

### Backend not starting:
```bash
# Check logs
heroku logs --tail

# Restart dyno
heroku restart
```

### Database connection error:
```bash
# Check database URL
heroku config

# Reset database if needed
heroku pg:reset DATABASE_URL --confirm your-app-name
```

### Frontend can't reach backend:
- Check REACT_APP_API_URL is correct
- Verify CORS settings in server.js
- Check backend is actually running

### Game invitations not working:
- Clear browser cache
- Check WebSocket/polling is working
- Verify database tables exist

## 🚀 Optimization for Production

1. **Add Caching**:
```javascript
// In server.js
app.use(express.static('build', { maxAge: '1d' }));
```

2. **Compress Responses**:
```bash
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());
```

3. **Add Helmet for Security**:
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

## 📊 Monitoring

### Heroku Dashboard:
- View logs
- Check dyno usage
- Monitor database

### Add Error Tracking (Optional):
- [Sentry](https://sentry.io/) for error tracking
- [LogRocket](https://logrocket.com/) for session replay

## 💰 Cost Estimates

### Free Tier (Sufficient for Family Use):
- **Heroku**: Free (sleeps after 30 min inactivity)
- **Netlify**: Free (100GB bandwidth/month)
- **Railway**: Free ($5 credit/month)
- **Render**: Free (some limitations)

### Paid (If Needed):
- **Heroku Hobby**: $7/month (always on)
- **Railway Pro**: $5/month minimum
- **Render Starter**: $7/month

**Recommendation for Families**: Start with free tier, upgrade only if needed!

## 🎉 Success!

Once deployed:
1. Share the URL with your family
2. Both create accounts
3. Start playing and chatting!
4. Add new games together as a fun project

---

**Questions?** Check the main README.md or open an issue on GitHub!
