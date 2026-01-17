@echo off
echo.
echo 🎮 Parent-Child Game Platform Setup
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found
node --version

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ PostgreSQL is not installed!
    echo Please install PostgreSQL from https://www.postgresql.org/download/
    pause
    exit /b 1
)

echo ✅ PostgreSQL found
echo.

REM Create database
echo 📊 Creating database...
createdb parent_child_games 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Database already exists or creation failed
)

REM Install backend dependencies
echo.
echo 📦 Installing backend dependencies...
call npm install express cors jsonwebtoken pg dotenv nodemon

REM Create .env file if it doesn't exist
if not exist .env (
    echo.
    echo 🔧 Creating .env file...
    (
        echo DATABASE_URL=postgresql://localhost/parent_child_games
        echo JWT_SECRET=change-this-to-a-random-secret-key
        echo PORT=5000
        echo NODE_ENV=development
    ) > .env
    echo ✅ .env file created
)

REM Create frontend .env if it doesn't exist
if not exist .env.local (
    echo.
    echo 🔧 Creating frontend .env...
    echo REACT_APP_API_URL=http://localhost:5000 > .env.local
    echo ✅ Frontend .env created
)

echo.
echo ✨ Setup complete!
echo.
echo To start the platform:
echo 1. Start backend:  node server.js
echo 2. In new terminal, start frontend: npm start
echo.
echo Then open http://localhost:3000 in your browser!
echo.
echo For mobile access, find your computer's IP address and use:
echo http://YOUR-IP:3000
echo.
echo Happy gaming! 🎮👨‍👦
echo.
pause
