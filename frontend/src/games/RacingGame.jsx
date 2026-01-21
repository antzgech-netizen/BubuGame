import React, { useState, useEffect, useRef } from 'react';
import './RacingGame.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function RacingGame({ user, onClose, fetchUser }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerPosition, setPlayerPosition] = useState(50); // 0-100 (percentage)
  const [opponentPosition, setOpponentPosition] = useState(50);
  const [playerSpeed, setPlayerSpeed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [raceTime, setRaceTime] = useState(0);
  const [winner, setWinner] = useState(null);
  const [selectedCar, setSelectedCar] = useState('🏎️');
  
  const gameLoopRef = useRef(null);
  const timerRef = useRef(null);

  const carEmojis = ['🏎️', '🚗', '🚙', '🚕', '🚐', '🏁'];

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!gameStarted || gameOver) return;
      
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        accelerate();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver]);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = setInterval(() => {
        // Update player position
        setPlayerPosition(prev => {
          const newPos = prev + playerSpeed;
          if (newPos >= 100) {
            endRace('player');
            return 100;
          }
          return newPos;
        });

        // Update opponent position (AI)
        setOpponentPosition(prev => {
          const aiSpeed = 0.3 + Math.random() * 0.4; // Random speed for AI
          const newPos = prev + aiSpeed;
          if (newPos >= 100) {
            endRace('opponent');
            return 100;
          }
          return newPos;
        });

        // Decrease player speed (friction)
        setPlayerSpeed(prev => Math.max(0, prev - 0.1));
      }, 50);

      timerRef.current = setInterval(() => {
        setRaceTime(prev => prev + 0.1);
      }, 100);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver, playerSpeed]);

  const startCountdown = () => {
    setCountdown(3);
    let count = 3;
    
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(countdownInterval);
        setTimeout(() => {
          setGameStarted(true);
          setCountdown(null);
        }, 1000);
      }
    }, 1000);
  };

  const accelerate = () => {
    setPlayerSpeed(prev => Math.min(prev + 0.5, 2)); // Max speed of 2
  };

  const endRace = (winnerName) => {
    if (gameOver) return;
    
    setGameOver(true);
    setWinner(winnerName);
    
    if (winnerName === 'player') {
      const coins = raceTime < 10 ? 20 : raceTime < 15 ? 15 : 10;
      addCoins(coins);
    }
    
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setPlayerPosition(50);
    setOpponentPosition(50);
    setPlayerSpeed(0);
    setCountdown(3);
    setRaceTime(0);
    setWinner(null);
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

  return (
    <div className="racing-game-container">
      <div className="racing-header">
        <h2>🏁 Racing Game</h2>
        <p>Press SPACE or tap the button to go faster!</p>
      </div>

      {!gameStarted && !gameOver && countdown === 3 && (
        <div className="car-selection">
          <h3>Choose Your Car</h3>
          <div className="car-options">
            {carEmojis.map(car => (
              <button
                key={car}
                className={`car-option ${selectedCar === car ? 'selected' : ''}`}
                onClick={() => setSelectedCar(car)}
              >
                {car}
              </button>
            ))}
          </div>
          <button className="start-race-btn" onClick={startCountdown}>
            🏁 Start Race!
          </button>
        </div>
      )}

      {countdown !== null && countdown !== 3 && (
        <div className="countdown-overlay">
          <div className="countdown-number">
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        </div>
      )}

      {(gameStarted || gameOver) && (
        <>
          <div className="race-stats">
            <div className="stat-item">
              <span className="stat-label">Time</span>
              <span className="stat-value">{raceTime.toFixed(1)}s</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Speed</span>
              <span className="stat-value">{(playerSpeed * 50).toFixed(0)} mph</span>
            </div>
          </div>

          <div className="race-track">
            <div className="track-lane player-lane">
              <div className="lane-label">YOU</div>
              <div className="lane-lines"></div>
              <div 
                className="race-car player-car"
                style={{ left: `${playerPosition}%` }}
              >
                {selectedCar}
              </div>
            </div>

            <div className="track-lane opponent-lane">
              <div className="lane-label">OPPONENT</div>
              <div className="lane-lines"></div>
              <div 
                className="race-car opponent-car"
                style={{ left: `${opponentPosition}%` }}
              >
                🚙
              </div>
            </div>

            <div className="finish-line"></div>
          </div>

          <div className="controls">
            <button 
              className="accelerate-btn"
              onMouseDown={accelerate}
              onTouchStart={accelerate}
              disabled={gameOver}
            >
              🚀 ACCELERATE (SPACE)
            </button>
          </div>
        </>
      )}

      {gameOver && (
        <div className="race-result">
          <h3>
            {winner === 'player' ? '🎉 You Won!' : '😢 You Lost!'}
          </h3>
          <div className="result-details">
            <p>⏱️ Your Time: <strong>{raceTime.toFixed(2)}s</strong></p>
            {winner === 'player' && (
              <p className="reward">
                🪙 +{raceTime < 10 ? 20 : raceTime < 15 ? 15 : 10} coins!
              </p>
            )}
          </div>
          <button className="play-again-btn" onClick={resetGame}>
            🔄 Race Again
          </button>
        </div>
      )}
    </div>
  );
}
