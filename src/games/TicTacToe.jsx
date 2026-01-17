import React, { useState, useEffect } from 'react';
import './TicTacToe.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function TicTacToe({ user, onClose, fetchUser }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  
  // Multiplayer states
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [matchId, setMatchId] = useState(null);
  const [mySymbol, setMySymbol] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [inviteStatus, setInviteStatus] = useState('');
  const [outgoingInviteId, setOutgoingInviteId] = useState(null);
  const [incomingInvite, setIncomingInvite] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMultiplayer) checkIncomingInvite();
      if (outgoingInviteId) checkInviteStatus();
      if (isMultiplayer && matchId) pollMatch();
    }, 2000);
    return () => clearInterval(interval);
  }, [isMultiplayer, matchId, outgoingInviteId]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('game_token')}`
  });

  const checkIncomingInvite = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tictactoe/invite/check`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.invite) setIncomingInvite(data.invite);
    } catch (err) {
      console.error('Check invite error:', err);
    }
  };

  const checkInviteStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tictactoe/invite/status/${outgoingInviteId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.status === 'accepted' && data.matchId) {
        setMatchId(data.matchId);
        setIsMultiplayer(true);
        setMySymbol('X'); // Inviter is always X
        setOutgoingInviteId(null);
        setShowInvite(false);
        resetGame();
      } else if (data.status === 'declined') {
        setInviteStatus('Invite declined');
        setOutgoingInviteId(null);
      }
    } catch (err) {
      console.error('Check invite status error:', err);
    }
  };

  const pollMatch = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tictactoe/match/${matchId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.match) {
        setBoard(data.match.board);
        setIsXNext(data.match.current_turn === 'X');
        
        if (data.match.winner) {
          setWinner(data.match.winner);
          setGameOver(true);
        } else if (data.match.board.every(cell => cell !== null)) {
          setWinner('Draw');
          setGameOver(true);
        }
      }
    } catch (err) {
      console.error('Poll match error:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tictactoe/players`, {
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
      const res = await fetch(`${API_URL}/api/tictactoe/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opponentId: selectedPlayer.id })
      });

      const data = await res.json();
      if (res.ok) {
        setOutgoingInviteId(data.inviteId);
        setInviteStatus('Waiting for opponent...');
      } else {
        setInviteStatus(data.error || 'Invite failed');
      }
    } catch (err) {
      setInviteStatus('Invite failed');
    }
  };

  const respondToInvite = async (accepted) => {
    if (!incomingInvite) return;

    try {
      const res = await fetch(`${API_URL}/api/tictactoe/invite/respond`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ inviteId: incomingInvite.id, accepted })
      });

      const data = await res.json();
      if (accepted && data.matchId) {
        setMatchId(data.matchId);
        setIsMultiplayer(true);
        setMySymbol('O'); // Accepter is always O
        resetGame();
      }
      setIncomingInvite(null);
    } catch (err) {
      console.error('Respond invite error:', err);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
    setGameOver(false);
  };

  const handleClick = async (index) => {
    if (board[index] || gameOver) return;

    if (isMultiplayer) {
      const currentTurn = isXNext ? 'X' : 'O';
      if (currentTurn !== mySymbol) return;

      const newBoard = [...board];
      newBoard[index] = mySymbol;

      try {
        await fetch(`${API_URL}/api/tictactoe/move`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ matchId, board: newBoard, position: index })
        });
      } catch (err) {
        console.error('Move error:', err);
      }
    } else {
      const newBoard = [...board];
      newBoard[index] = isXNext ? 'X' : 'O';
      setBoard(newBoard);

      const gameWinner = calculateWinner(newBoard);
      if (gameWinner) {
        setWinner(gameWinner);
        setGameOver(true);
        if (gameWinner === 'X') {
          await addCoins(10);
        }
      } else if (newBoard.every(cell => cell !== null)) {
        setWinner('Draw');
        setGameOver(true);
      } else {
        setIsXNext(!isXNext);
        // Computer move
        setTimeout(() => computerMove(newBoard), 500);
      }
    }
  };

  const computerMove = (currentBoard) => {
    const emptyIndices = currentBoard
      .map((cell, idx) => (cell === null ? idx : null))
      .filter(idx => idx !== null);

    if (emptyIndices.length === 0) return;

    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const newBoard = [...currentBoard];
    newBoard[randomIndex] = 'O';
    setBoard(newBoard);

    const gameWinner = calculateWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setGameOver(true);
    } else if (newBoard.every(cell => cell !== null)) {
      setWinner('Draw');
      setGameOver(true);
    } else {
      setIsXNext(true);
    }
  };

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
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
    <div className="tictactoe-container">
      <div className="tictactoe-header">
        <h2>⭕ Tic-Tac-Toe</h2>
        <p>{isMultiplayer ? `You are ${mySymbol}` : 'Play vs Computer'}</p>
      </div>

      {incomingInvite && (
        <div className="invite-popup">
          <h3>🎮 Game Invitation</h3>
          <p><strong>{incomingInvite.fromUsername}</strong> wants to play!</p>
          <div className="invite-actions">
            <button onClick={() => respondToInvite(true)}>✓ Accept</button>
            <button onClick={() => respondToInvite(false)}>✗ Decline</button>
          </div>
        </div>
      )}

      {!isMultiplayer && !gameOver && (
        <button 
          className="invite-btn"
          onClick={() => {
            setShowInvite(!showInvite);
            if (!showInvite) loadPlayers();
          }}
        >
          🤝 Invite Player
        </button>
      )}

      {showInvite && (
        <div className="invite-panel">
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
          <button onClick={sendInvite}>Send Invite</button>
          {inviteStatus && <p>{inviteStatus}</p>}
        </div>
      )}

      <div className="game-status">
        {gameOver ? (
          <h3>
            {winner === 'Draw' ? "It's a Draw!" : 
             isMultiplayer ? (winner === mySymbol ? '🎉 You Won!' : 'You Lost!') :
             winner === 'X' ? '🎉 You Won! +10 coins' : 'Computer Wins!'}
          </h3>
        ) : (
          <h3>
            {isMultiplayer ? 
              (isXNext === (mySymbol === 'X') ? 'Your Turn' : "Opponent's Turn") :
              (isXNext ? 'Your Turn (X)' : 'Computer Turn (O)')}
          </h3>
        )}
      </div>

      <div className="tictactoe-board">
        {board.map((cell, index) => (
          <button
            key={index}
            className={`cell ${cell ? 'filled' : ''}`}
            onClick={() => handleClick(index)}
          >
            {cell}
          </button>
        ))}
      </div>

      {gameOver && (
        <button className="play-again-btn" onClick={() => {
          if (isMultiplayer) {
            setIsMultiplayer(false);
            setMatchId(null);
            setMySymbol(null);
          }
          resetGame();
        }}>
          Play Again
        </button>
      )}
    </div>
  );
}
