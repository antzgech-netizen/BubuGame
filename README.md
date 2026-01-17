# 🎮 Parent-Child Game Platform

A beautiful, mobile-friendly game platform that lets parents and children play together even when they're in different countries! Features real-time chat, multiple games, and works on PC, Android tablets, and iPhones.

## ✨ Features

- 🎯 **Two Games Ready to Play**:
  - **Gebeta**: Traditional Ethiopian strategy game
  - **Tic-Tac-Toe**: Classic X and O game
  
- 💬 **Real-Time Chat**: Talk to each other while playing
- 🎨 **Beautiful Design**: Colorful, kid-friendly interface
- 📱 **Works Everywhere**: PC, Android, iPhone, iPad
- 👥 **Multiplayer**: Invite each other to play together
- 🪙 **Coin System**: Earn coins by winning games
- 🔐 **Secure Login**: Each person has their own account

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
2. **PostgreSQL** database - [Download here](https://www.postgresql.org/download/)

### Installation

1. **Clone or download this project**

2. **Set up the Backend**:
```bash
cd parent-child-games

# Install backend dependencies
npm install express cors jsonwebtoken pg dotenv

# Create .env file
echo "DATABASE_URL=postgresql://localhost/parent_child_games
JWT_SECRET=your-secret-key-here
PORT=5000" > .env

# Create the database
createdb parent_child_games

# Start the backend server
node server.js
```

3. **Set up the Frontend** (in a new terminal):
```bash
cd parent-child-games

# Install React dependencies
npm install

# Create .env file for frontend
echo "REACT_APP_API_URL=http://localhost:5000" > .env

# Start the frontend
npm start
```

4. **Open in your browser**: http://localhost:3000

## 📱 Mobile Setup

### For Android Tablets:
1. Find your computer's IP address:
   - Windows: Open Command Prompt, type `ipconfig`
   - Mac/Linux: Open Terminal, type `ifconfig`
   - Look for something like `192.168.1.xxx`

2. On the tablet browser, go to: `http://YOUR-IP-ADDRESS:3000`
   - Example: `http://192.168.1.100:3000`

### For iPhone/iPad:
Same as Android - just open Safari and go to `http://YOUR-IP-ADDRESS:3000`

**Important**: Make sure all devices are on the same WiFi network!

## 🎮 How to Play

1. **Create Accounts**:
   - Parent creates an account
   - Child creates an account
   - Both can use any username/password they want

2. **Start Chatting**:
   - Click the "💬 Chat" button at the bottom right
   - Send messages to each other!

3. **Play Games**:
   - Pick a game from the home screen
   - Click "🤝 Invite" to invite the other player
   - Accept the invitation and start playing!

4. **Win Coins**:
   - Win games to earn coins
   - Coins are shown at the top of the screen

## 🌐 Making it Work Online (Internet Access)

If you want to play when you're in different countries, you have two options:

### Option 1: Deploy to Heroku (Free Tier)
1. Create account at [Heroku](https://www.heroku.com/)
2. Install Heroku CLI
3. Deploy backend:
```bash
heroku create your-game-backend
heroku addons:create heroku-postgresql:mini
git push heroku main
```

### Option 2: Use Ngrok (Quick Testing)
1. Download [Ngrok](https://ngrok.com/)
2. Run your backend: `node server.js`
3. In another terminal: `ngrok http 5000`
4. Share the ngrok URL with your family!

## 🎨 Customization Ideas

You and your child can design new games together! Here are some ideas:

1. **Memory Match Game**: Match pairs of cards
2. **Racing Game**: Simple car racing
3. **Drawing Game**: Draw pictures together
4. **Word Guessing**: Guess the word game
5. **Math Quiz**: Fun math questions

## 📁 Project Structure

```
parent-child-games/
├── src/
│   ├── App.jsx              # Main app component
│   ├── App.css              # Main styling
│   ├── components/
│   │   ├── LoginScreen.jsx  # Login/Register
│   │   ├── LoginScreen.css
│   │   ├── ChatBox.jsx      # Chat component
│   │   └── ChatBox.css
│   └── games/
│       ├── GebetaGame.jsx   # Gebeta game
│       ├── TicTacToe.jsx    # Tic-Tac-Toe game
│       └── TicTacToe.css
├── server.js                # Backend server
├── package.json             # Frontend dependencies
└── README.md               # This file
```

## 🛠️ Troubleshooting

### Backend won't start:
- Make sure PostgreSQL is running
- Check if port 5000 is available
- Verify DATABASE_URL in .env file

### Frontend won't start:
- Delete `node_modules` folder
- Run `npm install` again
- Check if port 3000 is available

### Can't connect from phone:
- Make sure phone and computer are on same WiFi
- Check your computer's firewall settings
- Try disabling firewall temporarily

### Games not updating:
- Refresh the page
- Clear browser cache
- Check backend server is running

## 🎯 Future Features (Add Together!)

- [ ] Voice chat while playing
- [ ] More games (Memory, Racing, Drawing)
- [ ] Friend requests system
- [ ] Achievements and badges
- [ ] Daily challenges
- [ ] Game replays
- [ ] Leaderboards
- [ ] Custom avatars

## 💝 Tips for Parents

1. **Schedule Game Time**: Set regular times to play together
2. **Let Your Child Choose**: Let them pick which game to play
3. **Celebrate Wins**: Make it fun, not competitive
4. **Build Together**: Work on adding new features as a learning project
5. **Stay Connected**: Use the chat to share daily updates

## 🤝 Contributing

This is a family project! Feel free to:
- Add new games
- Improve the design
- Fix bugs
- Add features your child wants

## 📄 License

This project is open source and free to use. Share it with other families!

## ❤️ Made with Love

Created for parents and children to stay connected through play, no matter the distance.

---

**Need Help?** 
- Check the troubleshooting section
- Make sure all prerequisites are installed
- Verify both backend and frontend are running

**Happy Gaming! 🎮👨‍👦**
