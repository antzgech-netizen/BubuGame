import React, { useState, useEffect } from 'react';
import './MemoryMatch.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Fun emojis for the cards
const EMOJI_SETS = {
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'],
  food: ['🍎', '🍌', '🍕', '🍔', '🍦', '🍪', '🍩', '🍰'],
  space: ['🚀', '🛸', '🌟', '🌙', '⭐', '🪐', '🌍', '👽'],
  sports: ['⚽', '🏀', '🎾', '⚾', '🏈', '🏐', '🎱', '🏓']
};

export default function MemoryMatch({ user, onClose, fetchUser }) {
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('animals');
  const [difficulty, setDifficulty] = useState('easy'); // easy: 8 cards, medium: 12, hard: 16
  const [timer, setTimer] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    if (isGameStarted) {
      const interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isGameStarted]);

  useEffect(() => {
    if (matchedPairs.length === cards.length / 2 && cards.length > 0) {
      setGameWon(true);
      setIsGameStarted(false);
      const coins = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15;
      addCoins(coins);
    }
  }, [matchedPairs, cards]);

  const initializeGame = () => {
    const numPairs = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8;
    const emojis = EMOJI_SETS[selectedTheme].slice(0, numPairs);
    const gameCards = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }));
    
    setCards(gameCards);
    setFlippedIndices([]);
    setMatchedPairs([]);
    setMoves(0);
    setGameWon(false);
    setTimer(0);
    setIsGameStarted(true);
  };

  const handleCardClick = (index) => {
    if (!isGameStarted || flippedIndices.length === 2 || flippedIndices.includes(index) || matchedPairs.includes(cards[index].emoji)) {
      return;
    }

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [firstIndex, secondIndex] = newFlipped;
      
      if (cards[firstIndex].emoji === cards[secondIndex].emoji) {
        // Match found!
        setMatchedPairs([...matchedPairs, cards[firstIndex].emoji]);
        setTimeout(() => setFlippedIndices([]), 500);
      } else {
        // No match
        setTimeout(() => setFlippedIndices([]), 1000);
      }
    }
  };

  const addCoins = async (amount) => {
    try {
      await fetch(`${API_URL}/api/user/add-coins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('game_token')}`
        },
        body: JSON.stringify({ amount })
      });
      if (fetchUser) fetchUser();
    } catch (err) {
      console.error('Add coins error:', err);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="memory-match-container">
      <div className="memory-header">
        <h2>🧠 Memory Match</h2>
        <p>Find all the matching pairs!</p>
      </div>

      {!isGameStarted && !gameWon && (
        <div className="game-setup">
          <div className="setup-section">
            <label>Choose Theme:</label>
            <div className="theme-selector">
              {Object.keys(EMOJI_SETS).map(theme => (
                <button
                  key={theme}
                  className={`theme-btn ${selectedTheme === theme ? 'active' : ''}`}
                  onClick={() => setSelectedTheme(theme)}
                >
                  {EMOJI_SETS[theme][0]} {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-section">
            <label>Difficulty:</label>
            <div className="difficulty-selector">
              <button
                className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setDifficulty('easy')}
              >
                😊 Easy (8 cards)
              </button>
              <button
                className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`}
                onClick={() => setDifficulty('medium')}
              >
                😎 Medium (12 cards)
              </button>
              <button
                className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setDifficulty('hard')}
              >
                🔥 Hard (16 cards)
              </button>
            </div>
          </div>

          <button className="start-game-btn" onClick={initializeGame}>
            🎮 Start Game
          </button>
        </div>
      )}

      {isGameStarted && (
        <>
          <div className="game-stats">
            <div className="stat-box">
              <span className="stat-label">Moves</span>
              <span className="stat-value">{moves}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Matched</span>
              <span className="stat-value">{matchedPairs.length}/{cards.length / 2}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Time</span>
              <span className="stat-value">{formatTime(timer)}</span>
            </div>
          </div>

          <div className={`memory-grid ${difficulty}`}>
            {cards.map((card, index) => {
              const isFlipped = flippedIndices.includes(index) || matchedPairs.includes(card.emoji);
              return (
                <div
                  key={card.id}
                  className={`memory-card ${isFlipped ? 'flipped' : ''} ${matchedPairs.includes(card.emoji) ? 'matched' : ''}`}
                  onClick={() => handleCardClick(index)}
                >
                  <div className="card-inner">
                    <div className="card-front">❓</div>
                    <div className="card-back">{card.emoji}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {gameWon && (
        <div className="game-won">
          <h3>🎉 Congratulations!</h3>
          <p>You found all pairs!</p>
          <div className="win-stats">
            <p>⏱️ Time: <strong>{formatTime(timer)}</strong></p>
            <p>🎯 Moves: <strong>{moves}</strong></p>
            <p className="reward">
              🪙 +{difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15} coins!
            </p>
          </div>
          <button className="play-again-btn" onClick={initializeGame}>
            🔄 Play Again
          </button>
        </div>
      )}
    </div>
  );
}
