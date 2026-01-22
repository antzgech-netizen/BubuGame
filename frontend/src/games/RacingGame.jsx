import React, { useState, useEffect, useRef } from 'react';
import './RacingGame.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function RacingGame({ user, onClose, fetchUser }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerPosition, setPlayerPosition] = useState(0);
  const [opponentPosition, setOpponentPosition] = useState(0);
  const [roadPosition, setRoadPosition] = useState(0);
  const [playerSpeed, setPlayerSpeed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [raceTime, setRaceTime] = useState(0);
  const [winner, setWinner] = useState(null);
  const [selectedCar, setSelectedCar] = useState('🏎️');
  
  // Multiplayer states
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [matchId, setMatchId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [inviteStatus, setInviteStatus] = useState('');
  const [incomingInvite, setIncomingInvite] = useState(null);
  
  const gameLoopRef = useRef(null);
  const timerRef = useRef(null);

  const carEmojis = ['🏎️', '🚗', '🚙', '🚕', '🚐', '🏁'];

  useEffect(() => {
    if (!isMultiplayer) {
      const interval = setInterval(checkIncomingInvite, 2000);
      return () => clearInterval(interval);
    }
  }, [isMultiplayer]);

  useEffect(() => {
    if (matchId) {
      const interval = setInterval(pollMatch, 500);
      return () => clearInterval(interval);
    }
  }, [matchId]);

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
        // Move road (visual effect)
        setRoadPosition(prev => (prev + 10) % 100);

        // Update player position
        setPlayerPosition(prev => {
          const newPos = prev + playerSpeed;
          if (newPos >= 100) {
            endRace('player');
            return 100;
          }
          return newPos;
        });

        // Update opponent position (AI for single player)
        if (!isMultiplayer) {
          setOpponentPosition(prev => {
            const aiSpeed = 0.3 + Math.random() * 0.4;
            const newPos = prev + aiSpeed;
            if (newPos >= 100) {
              endRace('opponent');
              return 100;
            }
            return newPos;
          });
        }

        // Decrease player speed (friction)
        setPlayerSpeed(prev => Math.max(0, prev - 0.1));

        // Send position to server if multiplayer
        if (isMultiplayer && matchId) {
          updateMatchPosition(playerPosition, playerSpeed);
        }
      }, 50);

      timerRef.current = setInterval(() => {
        setRaceTime(prev => prev + 0.1);
      }, 100);
    }

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver, playerSpeed, isMultiplayer, matchId]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

  const checkIncomingInvite = async () => {
    try {
      const res = await fetch(`${API_URL}/api/racing/invite/check`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.invite) {
        setIncomingInvite(data.invite);
      }
    } catch (err) {
      console.error('Check invite error:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/racing/players`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (err) {
      console.error('Load players error:', err);
    }
  };

  const sendInvite = async () => {
    if (!selectedPlayer) {
      setInviteStatus('Please select a player');
      return;
    }

    try {
      setInviteStatus('Sending invite...');
      const res = await fetch(`${API_URL}/api/racing/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opponentId: selectedPlayer.id })
      });

      const data = await res.json();
      if (res.ok) {
        setInviteStatus('Invite sent! Waiting for response...');
        pollInviteStatus(data.inviteId);
      } else {
        setInviteStatus(data.error || 'Invite failed');
      }
    } catch (err) {
      setInviteStatus('Invite failed');
    }
  };

  const pollInviteStatus = async (inviteId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/racing/invite/status/${inviteId}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();

        if (data.status === 'accepted' && data.matchId) {
          clearInterval(interval);
          setMatchId(data.matchId);
          setIsMultiplayer(true);
          setShowInvite(false);
          setInviteStatus('');
          resetGame();
          setTimeout(() => startCountdown(), 1000);
        } else if (data.status === 'declined') {
          clearInterval(interval);
          setInviteStatus('Invite declined');
          setTimeout(() => setInviteStatus(''), 3000);
        }
      } catch (err) {
        console.error('Poll invite error:', err);
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      if (!matchId) {
        setInviteStatus('No response');
        setTimeout(() => setInviteStatus(''), 3000);
      }
    }, 30000);
  };

  const respondToInvite = async (accepted) => {
    if (!incomingInvite) return;

    try {
      const res = await fetch(`${API_URL}/api/racing/invite/respond`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ inviteId: incomingInvite.id, accepted })
      });

      const data = await res.json();
      if (accepted && data.matchId) {
        setMatchId(data.matchId);
        setIsMultiplayer(true);
        setIncomingInvite(null);
        resetGame();
        setTimeout(() => startCountdown(), 1000);
      } else {
        setIncomingInvite(null);
      }
    } catch (err) {
      console.error('Respond invite error:', err);
      setIncomingInvite(null);
    }
  };

  const updateMatchPosition = async (position, speed) => {
    try {
      await fetch(`${API_URL}/api/racing/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ matchId, position, speed })
      });
    } catch (err) {
      // Silent fail
    }
  };

  const pollMatch = async () => {
    try {
      const res = await fetch(`${API_URL}/api/racing/match/${matchId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.match) {
        const opponent = data.match.player1_id === user.id ? 
          data.match.player2_position : data.match.player1_position;
        setOpponentPosition(opponent || 0);

        if (data.match.winner) {
          endRace(data.match.winner === user.id ? 'player' : 'opponent');
        }
      }
    } catch (err) {
      // Silent fail
    }
  };

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
    setPlayerSpeed(prev => Math.min(prev + 0.5, 2));
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
    setPlayerPosition(0);
    setOpponentPosition(0);
    setRoadPosition(0);
    setPlayerSpeed(0);
    setCountdown(3);
    setRaceTime(0);
    setWinner(null);
  };

  const addCoins = async (amount) => {
    try {
      await fetch(`${API_URL}/api/user/add-coins`, {
        method: 'POST',
        headers: getAuthHeaders(),
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
        <p>Press SPACE or tap button to accelerate!</p>
      </div>

      {incomingInvite && (
        <div className="invite-popup-overlay">
          <div className="invite-popup">
            <h3>🏁 Race Invitation!</h3>
            <p><strong>{incomingInvite.fromUsername}</strong> wants to race!</p>
            <div className="invite-actions">
              <button className="accept-btn" onClick={() => respondToInvite(true)}>
                ✓ Accept
              </button>
              <button className="decline-btn" onClick={() => respondToInvite(false)}>
                ✗ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {!gameStarted && !gameOver && countdown === 3 && !incomingInvite && (
        <>
          {!isMultiplayer && (
            <button 
              className="multiplayer-btn"
              onClick={() => {
                setShowInvite(!showInvite);
                if (!showInvite) loadPlayers();
              }}
            >
              🤝 {showInvite ? 'Cancel' : 'Invite Player'}
            </button>
          )}

          {showInvite && (
            <div className="invite-panel">
              <h4>Invite a player to race:</h4>
              <select 
                value={selectedPlayer?.id || ''}
                onChange={(e) => {
                  const p = players.find(pl => pl.id === parseInt(e.target.value));
                  setSelectedPlayer(p || null);
                }}
              >
                <option value="">Select player</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
              <button onClick={sendInvite} disabled={!selectedPlayer}>
                Send Invite
              </button>
              {inviteStatus && <p className="invite-status">{inviteStatus}</p>}
            </div>
          )}

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
        </>
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
              <div 
                className="lane-lines"
                style={{ 
                  backgroundPosition: `${roadPosition}px 0`
                }}
              ></div>
              <div 
                className="race-car player-car"
                style={{ 
                  left: `${Math.min(playerPosition, 90)}%`,
                  transform: `translateY(-50%) ${playerSpeed > 0 ? 'translateX(2px)' : ''}`
                }}
              >
                {selectedCar}
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill player-progress"
                  style={{ width: `${playerPosition}%` }}
                ></div>
              </div>
            </div>

            <div className="track-lane opponent-lane">
              <div className="lane-label">OPPONENT</div>
              <div 
                className="lane-lines"
                style={{ 
                  backgroundPosition: `${roadPosition}px 0`
                }}
              ></div>
              <div 
                className="race-car opponent-car"
                style={{ left: `${Math.min(opponentPosition, 90)}%` }}
              >
                🚙
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill opponent-progress"
                  style={{ width: `${opponentPosition}%` }}
                ></div>
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
          <button className="play-again-btn" onClick={() => {
            setIsMultiplayer(false);
            setMatchId(null);
            resetGame();
          }}>
            🔄 Race Again
          </button>
        </div>
      )}
    </div>
  );
}
