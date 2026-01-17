import React, { useState, useEffect } from 'react';
import './GebetaGame.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function GebetaGame({ user, onClose, fetchUser }) {
  const [board, setBoard] = useState([4,4,4,4,4,4,4,4,4,4,4,4]);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState('player');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState('Your turn! Select a pit.');
  const [animating, setAnimating] = useState(false);

  // Multiplayer states
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [inviteStatus, setInviteStatus] = useState('');

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [matchId, setMatchId] = useState(null);
  const [matchState, setMatchState] = useState(null);

  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInviteId, setOutgoingInviteId] = useState(null);
  const [opponentName, setOpponentName] = useState('Opponent');

  // Poll for match updates and invitations
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMultiplayer || gameOver) {
        checkIncomingInvite();
      }
      if (outgoingInviteId) checkOutgoingInviteStatus();
      if (isMultiplayer && matchId) pollMatchState();
    }, 2000);
    return () => clearInterval(interval);
  }, [isMultiplayer, matchId, outgoingInviteId, gameOver]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('game_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const resetGame = () => {
    setBoard([4,4,4,4,4,4,4,4,4,4,4,4]);
    setPlayerScore(0);
    setOpponentScore(0);
    setCurrentPlayer('player');
    setGameOver(false);
    setWinner(null);
    setMessage('Your turn! Select a pit.');
  };

  const fullReset = () => {
    setIsMultiplayer(false);
    setMatchId(null);
    setMatchState(null);
    setPlayerScore(0);
    setOpponentScore(0);
    resetGame();
  };

  // Invitation functions
  const handleInviteClick = async () => {
    setShowInvitePanel(prev => !prev);
    setInviteStatus('');
    if (!showInvitePanel) await loadAvailablePlayers();
  };

  const loadAvailablePlayers = async () => {
    try {
      setPlayersLoading(true);
      const res = await fetch(`${API_URL}/api/gebeta/players`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      const filtered = (data.players || []).filter(p => String(p.id) !== String(user.id));
      setAvailablePlayers(filtered);
    } catch (err) {
      console.error('Load players error:', err);
    } finally {
      setPlayersLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!selectedPlayer) {
      setInviteStatus('Select a player.');
      return;
    }

    try {
      setInviteStatus('Sending invite...');
      const res = await fetch(`${API_URL}/api/gebeta/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          opponentId: selectedPlayer.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setInviteStatus(data.error || 'Invite failed.');
        return;
      }

      setOutgoingInviteId(data.inviteId);
      setInviteStatus('Invite sent. Waiting for opponent...');
      setMessage('Waiting for opponent to accept...');
    } catch (err) {
      console.error('Send invite error:', err);
      setInviteStatus('Invite failed.');
    }
  };

  const checkIncomingInvite = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gebeta/invite/check`, {
        method: 'GET',
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

  const checkOutgoingInviteStatus = async () => {
    if (!outgoingInviteId) return;

    try {
      const res = await fetch(`${API_URL}/api/gebeta/invite/status/${outgoingInviteId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!data.exists) return;

      if (data.status === 'declined') {
        setInviteStatus('Opponent declined.');
        setOutgoingInviteId(null);
        return;
      }

      if (data.status === 'accepted' && data.matchId) {
        setMatchId(data.matchId);
        setIsMultiplayer(true);
        setInviteStatus('');
        setMessage('Your turn! Select a pit.');
        setOutgoingInviteId(null);
        setShowInvitePanel(false);
        resetGame();
      }
    } catch (err) {
      console.error('Check invite status error:', err);
    }
  };

  const respondToInvite = async (accepted) => {
    if (!incomingInvite) return;

    try {
      const res = await fetch(`${API_URL}/api/gebeta/invite/respond`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          inviteId: incomingInvite.id,
          accepted
        })
      });

      const data = await res.json();

      if (accepted && data.matchId) {
        setMatchId(data.matchId);
        setIsMultiplayer(true);
        
        if (incomingInvite.fromUsername) {
          setOpponentName(incomingInvite.fromUsername);
        }
        
        resetGame();
        setMessage('Your turn! Select a pit.');
      }

      setIncomingInvite(null);
    } catch (err) {
      console.error('Respond invite error:', err);
      setIncomingInvite(null);
    }
  };

  const pollMatchState = async () => {
    if (!matchId) return;

    try {
      const res = await fetch(`${API_URL}/api/gebeta/match/${matchId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!data.match) return;

      setMatchState(data.match);
      const match = data.match;

      if (match.board && JSON.stringify(match.board) !== JSON.stringify(board)) {
        setBoard(match.board);
      }

      if (match.player1_score !== undefined && match.player2_score !== undefined) {
        const amIPlayer1 = String(match.player1_id) === String(user.id);
        const serverPlayerScore = amIPlayer1 ? match.player1_score : match.player2_score;
        const serverOpponentScore = amIPlayer1 ? match.player2_score : match.player1_score;
        
        setPlayerScore(serverPlayerScore);
        setOpponentScore(serverOpponentScore);
      }

      if (match.current_player) {
        const isMyTurn = String(match.current_player) === String(user.id);
        setCurrentPlayer(isMyTurn ? 'player' : 'opponent');
        setMessage(isMyTurn ? 'Your turn! Select a pit.' : "Opponent's turn...");
      }

      if (match.finished && !gameOver) {
        const didWin = String(match.winner) === String(user.id);
        setWinner(didWin ? 'player' : 'opponent');
        setMessage(didWin ? '🎉 You Win!' : 'Opponent wins!');
        setGameOver(true);
      }
    } catch (err) {
      console.error('Poll match error:', err);
    }
  };

  const submitMultiplayerMove = async (newBoard, pitIndex, newPlayerScore, newOpponentScore) => {
    if (!matchId) return;
    
    const amIPlayer1 = matchState && String(matchState.player1_id) === String(user.id);
    const player1Score = amIPlayer1 ? newPlayerScore : newOpponentScore;
    const player2Score = amIPlayer1 ? newOpponentScore : newPlayerScore;
    
    try {
      await fetch(`${API_URL}/api/gebeta/move`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          matchId,
          board: newBoard,
          moveIndex: pitIndex,
          player1_score: player1Score,
          player2_score: player2Score
        })
      });
    } catch (err) {
      console.error('Submit move error:', err);
    }
  };

  const makeMove = async (pitIndex) => {
    if (animating || gameOver) return;

    if (isMultiplayer && currentPlayer !== 'player') return;
    if (!isMultiplayer && currentPlayer !== 'player') return;

    const amIPlayer1 = matchState && String(matchState.player1_id) === String(user.id);
    const myPits = isMultiplayer 
      ? (amIPlayer1 ? [0,1,2,3,4,5] : [6,7,8,9,10,11])
      : [0,1,2,3,4,5];

    if (!myPits.includes(pitIndex)) return;
    if (board[pitIndex] === 0) return;

    setAnimating(true);
    setMessage('Moving seeds...');

    let newBoard = [...board];
    let seeds = newBoard[pitIndex];
    newBoard[pitIndex] = 0;
    let currentIndex = pitIndex;
    let lastPit = -1;

    // Distribute seeds
    while (seeds > 0) {
      currentIndex = (currentIndex + 1) % 12;
      newBoard[currentIndex]++;
      seeds--;
      lastPit = currentIndex;
      setBoard([...newBoard]);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Check for capture
    let captured = 0;
    if (myPits.includes(lastPit) && (newBoard[lastPit] === 2 || newBoard[lastPit] === 4)) {
      captured = newBoard[lastPit];
      newBoard[lastPit] = 0;
      setPlayerScore(prev => prev + captured);
    }

    setBoard(newBoard);

    if (captured > 0) {
      setMessage(`You captured ${captured} seeds! 🎉`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Check if game over
    const p1Empty = newBoard.slice(0, 6).every(p => p === 0);
    const p2Empty = newBoard.slice(6, 12).every(p => p === 0);

    if (p1Empty || p2Empty) {
      await endGame(newBoard);
      setAnimating(false);
      return;
    }

    if (isMultiplayer) {
      const newPlayerScore = playerScore + captured;
      await submitMultiplayerMove(newBoard, pitIndex, newPlayerScore, opponentScore);
      setCurrentPlayer('opponent');
      setMessage("Opponent's turn...");
      setAnimating(false);
      return;
    }

    setCurrentPlayer('opponent');
    setMessage("Computer's turn...");
    await new Promise(resolve => setTimeout(resolve, 800));
    await computerMove(newBoard);

    setAnimating(false);
  };

  const computerMove = async (currentBoard) => {
    const validPits = currentBoard
      .slice(6, 12)
      .map((seeds, idx) => ({ idx: idx + 6, seeds }))
      .filter(p => p.seeds > 0);

    if (validPits.length === 0) {
      await endGame(currentBoard);
      return;
    }

    const chosen = validPits[Math.floor(Math.random() * validPits.length)];

    let newBoard = [...currentBoard];
    let seeds = newBoard[chosen.idx];
    newBoard[chosen.idx] = 0;
    let currentIndex = chosen.idx;
    let lastPit = -1;

    while (seeds > 0) {
      currentIndex = (currentIndex + 1) % 12;
      newBoard[currentIndex]++;
      seeds--;
      lastPit = currentIndex;
      setBoard([...newBoard]);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    let captured = 0;
    if (lastPit >= 6 && lastPit <= 11 && (newBoard[lastPit] === 2 || newBoard[lastPit] === 4)) {
      captured = newBoard[lastPit];
      newBoard[lastPit] = 0;
      setOpponentScore(prev => prev + captured);
    }

    setBoard(newBoard);

    if (captured > 0) {
      setMessage(`Computer captured ${captured} seeds!`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    const p1Empty = newBoard.slice(0, 6).every(p => p === 0);
    const p2Empty = newBoard.slice(6, 12).every(p => p === 0);

    if (p1Empty || p2Empty) {
      await endGame(newBoard);
      return;
    }

    setCurrentPlayer('player');
    setMessage('Your turn! Select a pit.');
  };

  const endGame = async (finalBoard) => {
    const amIPlayer1 = matchState && String(matchState.player1_id) === String(user.id);

    const p1Remaining = finalBoard.slice(0, 6).reduce((a, b) => a + b, 0);
    const p2Remaining = finalBoard.slice(6, 12).reduce((a, b) => a + b, 0);

    let player1FinalScore, player2FinalScore;
    
    if (isMultiplayer && matchState) {
      player1FinalScore = (matchState.player1_score || 0) + p1Remaining;
      player2FinalScore = (matchState.player2_score || 0) + p2Remaining;
    } else {
      player1FinalScore = playerScore + p1Remaining;
      player2FinalScore = opponentScore + p2Remaining;
    }

    const finalPlayerScore = amIPlayer1 ? player1FinalScore : player2FinalScore;
    const finalOpponentScore = amIPlayer1 ? player2FinalScore : player1FinalScore;

    setPlayerScore(finalPlayerScore);
    setOpponentScore(finalOpponentScore);
    setGameOver(true);

    const didWin = finalPlayerScore > finalOpponentScore;
    setWinner(didWin ? 'player' : 'opponent');

    if (isMultiplayer && matchId) {
      setMessage(didWin ? '🎉 You Win!' : `${opponentName} wins!`);
      
      try {
        const finalPlayer1Score = amIPlayer1 ? finalPlayerScore : finalOpponentScore;
        const finalPlayer2Score = amIPlayer1 ? finalOpponentScore : finalPlayerScore;
        
        const winnerId = didWin ? user.id : (matchState.player1_id === user.id ? matchState.player2_id : matchState.player1_id);
        
        await fetch(`${API_URL}/api/gebeta/finish`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            matchId,
            winner: winnerId,
            playerScore: finalPlayer1Score,
            opponentScore: finalPlayer2Score
          })
        });
        
        if (fetchUser) {
          await new Promise(r => setTimeout(r, 500));
          await fetchUser();
        }
      } catch (err) {
        console.error('Finish error:', err);
      }
    } else {
      setMessage(didWin ? '🎉 You Win!' : 'Computer wins!');
      
      if (didWin) {
        try {
          await fetch(`${API_URL}/api/user/add-coins`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ amount: 20 })
          });
          
          if (fetchUser) {
            await new Promise(r => setTimeout(r, 500));
            await fetchUser();
          }
        } catch (err) {
          console.error('Failed to add coins:', err);
        }
      }
    }
  };

  const amIPlayer1 = matchState && String(matchState.player1_id) === String(user.id);

  const topRow = isMultiplayer
    ? (amIPlayer1 ? board.slice(6, 12).reverse() : board.slice(0, 6).reverse())
    : board.slice(6, 12).reverse();

  const bottomRow = isMultiplayer
    ? (amIPlayer1 ? board.slice(0, 6) : board.slice(6, 12))
    : board.slice(0, 6);

  const getActualPitIndex = (idx, isTop) => {
    if (isMultiplayer) {
      if (isTop) {
        return amIPlayer1 ? 11 - idx : 5 - idx;
      } else {
        return amIPlayer1 ? idx : idx + 6;
      }
    } else {
      if (isTop) {
        return 11 - idx;
      } else {
        return idx;
      }
    }
  };

  return (
    <div className="gebeta-container">
      {incomingInvite && !isMultiplayer && (
        <div className="incoming-invite-overlay">
          <div className="incoming-invite-popup">
            <h3>🎮 Game Invitation</h3>
            <p><strong>{incomingInvite.fromUsername}</strong> invited you to play!</p>
            <div className="invite-actions">
              <button className="invite-accept-btn" onClick={() => respondToInvite(true)}>
                ✓ Accept
              </button>
              <button className="invite-decline-btn" onClick={() => respondToInvite(false)}>
                ✗ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="gebeta-header">
        <h2>🎲 Gebeta</h2>
        <p className="subtitle">Ethiopian Traditional Game</p>
        
        {!isMultiplayer && !outgoingInviteId && !incomingInvite && !gameOver && (
          <button className="gebeta-invite-btn" onClick={handleInviteClick}>
            🤝 Invite Player
          </button>
        )}
        
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {showInvitePanel && (
        <div className="gebeta-invite-panel">
          <div className="invite-row">
            <div className="invite-column">
              <label>Available Players</label>
              {playersLoading ? (
                <div className="invite-status">Loading players...</div>
              ) : (
                <select
                  className="invite-select"
                  value={selectedPlayer?.id || ''}
                  onChange={e => {
                    const p = availablePlayers.find(pl => String(pl.id) === e.target.value);
                    setSelectedPlayer(p || null);
                  }}
                >
                  <option value="">Select player</option>
                  {availablePlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="invite-column">
              <button className="invite-send-btn" onClick={sendInvite}>
                Send Invite
              </button>
            </div>
          </div>

          {inviteStatus && <div className="invite-status">{inviteStatus}</div>}
        </div>
      )}

      <div className="gebeta-scores">
        <div className="score-box">
          <div className="score-label">You</div>
          <div className="score-value">{playerScore}</div>
        </div>
        <div className="score-box computer">
          <div className="score-label">{isMultiplayer ? opponentName : 'Computer'}</div>
          <div className="score-value">{opponentScore}</div>
        </div>
      </div>

      <div className="gebeta-message">{message}</div>

      <div className="gebeta-board">
        {/* Computer's/Opponent's side (top) */}
        <div className="board-row computer-row">
          {topRow.map((seeds, idx) => {
            const actualIdx = getActualPitIndex(idx, true);
            return (
              <div key={actualIdx} className="pit-wrapper">
                <div className="seeds-count">{seeds}</div>
                <div className="pit computer-pit">
                  <div className="seeds">
                    {Array(seeds).fill(0).map((_, i) => (
                      <span key={i} className="seed">●</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Player's side (bottom) */}
        <div className="board-row player-row">
          {bottomRow.map((seeds, idx) => {
            const actualIdx = getActualPitIndex(idx, false);
            const isClickable = currentPlayer === 'player' && seeds > 0 && !animating && !gameOver;
            return (
              <div key={actualIdx} className="pit-wrapper">
                <div
                  className={`pit player-pit ${seeds === 0 ? 'empty' : ''} ${isClickable ? 'clickable' : ''}`}
                  onClick={() => makeMove(actualIdx)}
                >
                  <div className="seeds">
                    {Array(seeds).fill(0).map((_, i) => (
                      <span key={i} className="seed">●</span>
                    ))}
                  </div>
                </div>
                <div className="seeds-count">{seeds}</div>
              </div>
            );
          })}
        </div>
      </div>

      {gameOver && (
        <div className="game-over">
          <h3>
            {winner === 'player' 
              ? '🎉 YOU WON!' 
              : `😔 ${isMultiplayer ? opponentName.toUpperCase() : 'COMPUTER'} WON!`
            }
          </h3>
          <p>
            Final Score: You {playerScore} – {opponentScore}{' '}
            {isMultiplayer ? opponentName : 'Computer'}
          </p>
          {winner === 'player' && !isMultiplayer && (
            <p className="reward">+20 Coins! 🪙</p>
          )}
          <button className="play-again-btn" onClick={fullReset}>
            {isMultiplayer ? 'New Game' : 'Play Again'}
          </button>
        </div>
      )}

      <div className="gebeta-footer">
        <small>Select your pits to move seeds • Capture 2 or 4 seeds</small>
      </div>
    </div>
  );
}
