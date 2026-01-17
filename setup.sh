#!/bin/bash

echo "🎮 Parent-Child Game Platform Setup"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed!"
    echo "Please install PostgreSQL from https://www.postgresql.org/download/"
    exit 1
fi

echo "✅ PostgreSQL found"
echo ""

# Create database
echo "📊 Creating database..."
createdb parent_child_games 2>/dev/null || echo "Database already exists"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
npm install express cors jsonwebtoken pg dotenv nodemon

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Creating .env file..."
    cat > .env << EOL
DATABASE_URL=postgresql://localhost/parent_child_games
JWT_SECRET=$(openssl rand -base64 32)
PORT=5000
NODE_ENV=development
EOL
    echo "✅ .env file created with random JWT secret"
fi

# Create frontend .env if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo "🔧 Creating frontend .env..."
    echo "REACT_APP_API_URL=http://localhost:5000" > .env.local
    echo "✅ Frontend .env created"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the platform:"
echo "1. Start backend:  node server.js"
echo "2. In new terminal, start frontend: npm start"
echo ""
echo "Then open http://localhost:3000 in your browser!"
echo ""
echo "For mobile access, find your computer's IP address and use:"
echo "http://YOUR-IP:3000"
echo ""
echo "Happy gaming! 🎮👨‍👦"
