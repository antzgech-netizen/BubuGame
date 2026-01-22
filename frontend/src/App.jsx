import React, { useState, useEffect } from 'react';
import './App.css';
import GebetaGame from './games/GebetaGame';
import TicTacToe from './games/TicTacToe';
import MemoryMatch from './games/MemoryMatch';
import RacingGame from './games/RacingGame';
import WhatsAppStyle from './components/WhatsAppStyle';
import LoginScreen from './components/LoginScreen';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('game_token');
    if (token) {
      fetchUser();
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Check for unread messages periodically
      const interval = setInterval(checkUnreadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchUser = async () => {
    const token = localStorage.getItem('game_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('game_token');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const checkUnreadMessages = async () => {
    const token = localStorage.getItem('game_token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const total = data.conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        setUnreadCount(total);
      }
    } catch (err) {
      // Silent fail
    }
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('game_token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('game_token');
    setUser(null);
    setCurrentGame(null);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1>🎮 Play Together</h1>
          <p className="subtitle">Stay connected through games!</p>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="username">👤 {user.username}</span>
            <span className="coins">🪙 {user.coins || 0}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {!currentGame ? (
          <div className="game-selection">
            <h2>🎯 Choose Your Adventure!</h2>
            <div className="game-grid">
              {/* Existing Games */}
              <div className="game-card" onClick={() => setCurrentGame('gebeta')}>
                <div className="game-icon">🎲</div>
                <h3>Gebeta</h3>
                <p>Traditional Ethiopian Strategy Game</p>
                <div className="game-badge">2 Players</div>
              </div>

              <div className="game-card" onClick={() => setCurrentGame('tictactoe')}>
                <div className="game-icon">⭕</div>
                <h3>Tic-Tac-Toe</h3>
                <p>Classic X and O Game</p>
                <div className="game-badge">2 Players</div>
              </div>

              {/* NEW GAMES! */}
              <div className="game-card" onClick={() => setCurrentGame('memory')}>
                <div className="game-icon">🧠</div>
                <h3>Memory Match</h3>
                <p>Find matching pairs!</p>
                <div className="game-badge">Brain Game</div>
              </div>

              <div className="game-card" onClick={() => setCurrentGame('racing')}>
                <div className="game-icon">🏁</div>
                <h3>Racing Game</h3>
                <p>Race to the finish line!</p>
                <div className="game-badge">Speed Game</div>
              </div>

              {/* Coming Soon */}
              <div className="game-card coming-soon">
                <div className="game-icon">🎨</div>
                <h3>Drawing Game</h3>
                <p>Coming Soon!</p>
                <div className="game-badge">Creative</div>
              </div>

              <div className="game-card coming-soon">
                <div className="game-icon">🧩</div>
                <h3>Puzzle Game</h3>
                <p>Coming Soon!</p>
                <div className="game-badge">Brain Teaser</div>
              </div>
            </div>

            <div className="welcome-message">
              <h3>👨‍👦 Welcome to Our Game Room!</h3>
              <p>🎮 Pick a game and have fun together!</p>
              <p>💬 Use WhatsApp to chat and call anytime!</p>
              <p>🪙 Earn coins by winning games!</p>
            </div>
          </div>
        ) : (
          <div className="game-container">
            <button className="back-btn" onClick={() => setCurrentGame(null)}>
              ⬅ Back to Games
            </button>

            {currentGame === 'gebeta' && (
              <GebetaGame 
                user={user} 
                onClose={() => setCurrentGame(null)}
                fetchUser={fetchUser}
              />
            )}

            {currentGame === 'tictactoe' && (
              <TicTacToe 
                user={user} 
                onClose={() => setCurrentGame(null)}
                fetchUser={fetchUser}
              />
            )}

            {currentGame === 'memory' && (
              <MemoryMatch 
                user={user} 
                onClose={() => setCurrentGame(null)}
                fetchUser={fetchUser}
              />
            )}

            {currentGame === 'racing' && (
              <RacingGame 
                user={user} 
                onClose={() => setCurrentGame(null)}
                fetchUser={fetchUser}
              />
            )}
          </div>
        )}
      </main>

      {/* WhatsApp Style Button - Combined Chat & Calls */}
      <button 
        className={`whatsapp-toggle-btn ${showWhatsApp ? 'active' : ''}`}
        onClick={() => setShowWhatsApp(!showWhatsApp)}
      >
        💬 WhatsApp
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>

      {/* WhatsApp Style Panel */}
      {showWhatsApp && (
        <WhatsAppStyle 
          user={user} 
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </div>
  );
}
