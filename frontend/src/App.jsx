import React, { useState, useEffect } from 'react';
import './App.css';
import GebetaGame from './games/GebetaGame';
import TicTacToe from './games/TicTacToe';
import ChatBox from './components/ChatBox';
import VoiceChat from './components/VoiceChat';
import LoginScreen from './components/LoginScreen';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('game_token');
    if (token) {
      fetchUser();
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
            <h2>Choose a Game to Play</h2>
            <div className="game-grid">
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

              <div className="game-card coming-soon">
                <div className="game-icon">🎯</div>
                <h3>Memory Match</h3>
                <p>Coming Soon!</p>
                <div className="game-badge">Design Together</div>
              </div>

              <div className="game-card coming-soon">
                <div className="game-icon">🏁</div>
                <h3>Racing Game</h3>
                <p>Coming Soon!</p>
                <div className="game-badge">Design Together</div>
              </div>
            </div>

            <div className="welcome-message">
              <h3>👨‍👦 Welcome to Our Game Room!</h3>
              <p>Pick a game and invite your family member to play together.</p>
              <p>💬 Don't forget to chat while playing!</p>
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
          </div>
        )}
      </main>

      {/* Chat Toggle Button */}
      <button 
        className={`chat-toggle-btn ${showChat ? 'active' : ''}`}
        onClick={() => {
          setShowChat(!showChat);
          if (!showChat) setUnreadMessages(0);
        }}
      >
        💬 Chat
        {unreadMessages > 0 && (
          <span className="unread-badge">{unreadMessages}</span>
        )}
      </button>

      {/* Voice Chat Toggle Button */}
      <button 
        className={`voice-toggle-btn ${showVoice ? 'active' : ''}`}
        onClick={() => {
          console.log('🎙️ Voice button clicked! Current state:', showVoice);
          setShowVoice(!showVoice);
          console.log('🎙️ Voice panel should now be:', !showVoice ? 'OPEN' : 'CLOSED');
        }}
      >
        🎙️ Voice
      </button>

      {/* Chat Panel */}
      {showChat && (
        <ChatBox 
          user={user} 
          onClose={() => setShowChat(false)}
          onNewMessage={() => {
            if (!showChat) {
              setUnreadMessages(prev => prev + 1);
            }
          }}
        />
      )}

      {/* Voice Chat Panel */}
      {showVoice && (
        <>
          {console.log('✅ Rendering VoiceChat panel')}
          <VoiceChat 
            user={user} 
            onClose={() => {
              console.log('🚪 Closing voice chat');
              setShowVoice(false);
            }}
          />
        </>
      )}
    </div>
  );
}
