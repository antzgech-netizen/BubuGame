// server.js - Parent-Child Game Platform Backend
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost/parent_child_games";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

console.log("🎮 Starting Parent-Child Game Platform...");

// PostgreSQL Connection
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ PostgreSQL Error:", err));

// Middleware: Authenticate JWT Token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// ==========================================
// AUTH ENDPOINTS
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Check if username exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, password, coins, created_at)
       VALUES ($1, $2, 100, NOW())
       RETURNING id, username, coins`,
      [username, password] // In production, hash the password!
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });

    console.log(`✅ New user registered: ${username}`);
    res.json({ success: true, token, user });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];

    // In production, compare hashed passwords!
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });

    console.log(`✅ User logged in: ${username}`);
    res.json({ success: true, token, user: { id: user.id, username: user.username, coins: user.coins } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, coins FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ==========================================
// USER ENDPOINTS
// ==========================================

app.post("/api/user/add-coins", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const result = await pool.query(
      `UPDATE users 
       SET coins = coins + $1
       WHERE id = $2
       RETURNING id, username, coins`,
      [amount, req.user.userId]
    );

    console.log(`💰 Added ${amount} coins to ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Add coins error:", err.message);
    res.status(500).json({ error: "Failed to add coins" });
  }
});

// ==========================================
// CHAT ENDPOINTS
// ==========================================

app.get("/api/chat/messages", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.user_id, m.message, m.created_at, u.username
       FROM chat_messages m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC
       LIMIT 50`
    );

    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    console.error("Get messages error:", err.message);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.post("/api/chat/send", authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, message, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [req.user.userId, message.trim()]
    );

    console.log(`💬 ${req.user.username}: ${message.substring(0, 50)}...`);
    res.json({ success: true, messageId: result.rows[0].id });
  } catch (err) {
    console.error("Send message error:", err.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ==========================================
// TIC-TAC-TOE ENDPOINTS
// ==========================================

app.get("/api/tictactoe/players", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, coins 
       FROM users 
       WHERE id != $1
       ORDER BY username`,
      [req.user.userId]
    );

    res.json({ players: result.rows });
  } catch (err) {
    console.error("Get players error:", err.message);
    res.status(500).json({ error: "Failed to get players" });
  }
});

app.post("/api/tictactoe/invite", authenticateToken, async (req, res) => {
  try {
    const { opponentId } = req.body;
    const userId = req.user.userId;

    console.log('📨 TicTacToe invite:', { from: userId, to: opponentId });

    const result = await pool.query(
      `INSERT INTO tictactoe_invites 
       (from_user_id, to_user_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [userId, opponentId]
    );

    res.json({ inviteId: result.rows[0].id, success: true });
  } catch (err) {
    console.error("Invite error:", err.message);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

app.get("/api/tictactoe/invite/check", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT i.id, u.username as fromUsername, u.id as fromUserId
       FROM tictactoe_invites i
       JOIN users u ON i.from_user_id = u.id
       WHERE i.to_user_id = $1 
         AND i.status = 'pending'
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json({ invite: result.rows[0] });
    } else {
      res.json({ invite: null });
    }
  } catch (err) {
    console.error("Check invite error:", err.message);
    res.status(500).json({ error: "Failed to check invites" });
  }
});

app.post("/api/tictactoe/invite/respond", authenticateToken, async (req, res) => {
  try {
    const { inviteId, accepted } = req.body;
    const userId = req.user.userId;

    if (!accepted) {
      await pool.query(
        `UPDATE tictactoe_invites SET status = 'declined' WHERE id = $1`,
        [inviteId]
      );
      return res.json({ success: true });
    }

    const inviteResult = await pool.query(
      `SELECT from_user_id, to_user_id FROM tictactoe_invites WHERE id = $1`,
      [inviteId]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const invite = inviteResult.rows[0];

    const matchResult = await pool.query(
      `INSERT INTO tictactoe_matches 
       (player1_id, player2_id, board, current_turn, created_at)
       VALUES ($1, $2, $3::jsonb, 'X', NOW())
       RETURNING id`,
      [invite.from_user_id, invite.to_user_id, JSON.stringify(Array(9).fill(null))]
    );

    const matchId = matchResult.rows[0].id;

    await pool.query(
      `UPDATE tictactoe_invites 
       SET status = 'accepted', match_id = $1 
       WHERE id = $2`,
      [matchId, inviteId]
    );

    console.log('✅ TicTacToe match created:', matchId);
    res.json({ success: true, matchId });
  } catch (err) {
    console.error("Respond to invite error:", err.message);
    res.status(500).json({ error: "Failed to respond to invitation" });
  }
});

app.get("/api/tictactoe/invite/status/:inviteId", authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;

    const result = await pool.query(
      `SELECT status, match_id FROM tictactoe_invites WHERE id = $1`,
      [inviteId]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const invite = result.rows[0];
    res.json({
      exists: true,
      status: invite.status,
      matchId: invite.match_id
    });
  } catch (err) {
    console.error("Check invite status error:", err.message);
    res.status(500).json({ error: "Failed to check invite status" });
  }
});

app.get("/api/tictactoe/match/:id", authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;

    const result = await pool.query(
      `SELECT * FROM tictactoe_matches WHERE id = $1`,
      [matchId]
    );

    if (result.rows.length === 0) {
      return res.json({ match: null });
    }

    res.json({ match: result.rows[0] });
  } catch (err) {
    console.error("Match poll error:", err.message);
    res.status(500).json({ error: "Failed to poll match" });
  }
});

app.post("/api/tictactoe/move", authenticateToken, async (req, res) => {
  try {
    const { matchId, board, position } = req.body;

    const boardJson = Array.isArray(board) ? JSON.stringify(board) : board;

    // Check for winner
    const boardArray = JSON.parse(boardJson);
    const winner = calculateWinner(boardArray);

    await pool.query(
      `UPDATE tictactoe_matches
       SET board = $1::jsonb,
           current_turn = CASE 
             WHEN current_turn = 'X' THEN 'O' 
             ELSE 'X' 
           END,
           winner = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [boardJson, winner, matchId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Move error:", err.message);
    res.status(500).json({ error: "Failed to submit move" });
  }
});

function calculateWinner(squares) {
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
}

// ==========================================
// GEBETA GAME ENDPOINTS
// ==========================================

app.get("/api/gebeta/players", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, coins 
       FROM users 
       WHERE id != $1
       ORDER BY username`,
      [req.user.userId]
    );

    res.json({ players: result.rows });
  } catch (err) {
    console.error("Get gebeta players error:", err.message);
    res.status(500).json({ error: "Failed to load players" });
  }
});

app.post("/api/gebeta/invite", authenticateToken, async (req, res) => {
  try {
    const { opponentId } = req.body;
    const userId = req.user.userId;

    console.log('📨 Gebeta invite:', { from: userId, to: opponentId });

    const result = await pool.query(
      `INSERT INTO gebeta_invites 
       (from_user_id, to_user_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [userId, opponentId]
    );

    res.json({ inviteId: result.rows[0].id, success: true });
  } catch (err) {
    console.error("Gebeta invite error:", err.message);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

app.get("/api/gebeta/invite/check", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT i.id, u.username as fromUsername, u.id as fromUserId
       FROM gebeta_invites i
       JOIN users u ON i.from_user_id = u.id
       WHERE i.to_user_id = $1 
         AND i.status = 'pending'
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      res.json({ invite: result.rows[0] });
    } else {
      res.json({ invite: null });
    }
  } catch (err) {
    console.error("Check gebeta invite error:", err.message);
    res.status(500).json({ error: "Failed to check invites" });
  }
});

app.post("/api/gebeta/invite/respond", authenticateToken, async (req, res) => {
  try {
    const { inviteId, accepted } = req.body;
    const userId = req.user.userId;

    if (!accepted) {
      await pool.query(
        `UPDATE gebeta_invites SET status = 'declined' WHERE id = $1`,
        [inviteId]
      );
      return res.json({ success: true });
    }

    const inviteResult = await pool.query(
      `SELECT from_user_id, to_user_id FROM gebeta_invites WHERE id = $1`,
      [inviteId]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const invite = inviteResult.rows[0];

    const matchResult = await pool.query(
      `INSERT INTO gebeta_matches 
       (player1_id, player2_id, board, player1_score, player2_score, 
        current_player, finished, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, 0, 0, $1, false, NOW(), NOW())
       RETURNING id`,
      [invite.from_user_id, invite.to_user_id, JSON.stringify([4,4,4,4,4,4,4,4,4,4,4,4])]
    );

    const matchId = matchResult.rows[0].id;

    await pool.query(
      `UPDATE gebeta_invites 
       SET status = 'accepted', match_id = $1 
       WHERE id = $2`,
      [matchId, inviteId]
    );

    console.log('✅ Gebeta match created:', matchId);
    res.json({ success: true, matchId });
  } catch (err) {
    console.error("Respond to gebeta invite error:", err.message);
    res.status(500).json({ error: "Failed to respond to invitation" });
  }
});

app.get("/api/gebeta/invite/status/:inviteId", authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;

    const result = await pool.query(
      `SELECT status, match_id FROM gebeta_invites WHERE id = $1`,
      [inviteId]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const invite = result.rows[0];
    res.json({
      exists: true,
      status: invite.status,
      matchId: invite.match_id
    });
  } catch (err) {
    console.error("Check gebeta invite status error:", err.message);
    res.status(500).json({ error: "Failed to check invite status" });
  }
});

app.get("/api/gebeta/match/:id", authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.id;

    const result = await pool.query(
      `SELECT * FROM gebeta_matches WHERE id = $1`,
      [matchId]
    );

    if (result.rows.length === 0) {
      return res.json({ match: null });
    }

    res.json({ match: result.rows[0] });
  } catch (err) {
    console.error("Gebeta match poll error:", err.message);
    res.status(500).json({ error: "Failed to poll match" });
  }
});

app.post("/api/gebeta/move", authenticateToken, async (req, res) => {
  try {
    const { matchId, board, moveIndex, player1_score, player2_score } = req.body;

    const boardJson = Array.isArray(board) ? JSON.stringify(board) : board;

    await pool.query(
      `UPDATE gebeta_matches
       SET board = $1::jsonb,
           player1_score = $2,
           player2_score = $3,
           current_player = CASE 
             WHEN current_player = player1_id THEN player2_id 
             ELSE player1_id 
           END,
           updated_at = NOW()
       WHERE id = $4`,
      [boardJson, player1_score || 0, player2_score || 0, matchId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Gebeta move error:", err.message);
    res.status(500).json({ error: "Failed to submit move" });
  }
});

app.post("/api/gebeta/finish", authenticateToken, async (req, res) => {
  try {
    const { matchId, winner, playerScore, opponentScore } = req.body;

    console.log('🏁 Finishing gebeta match:', { matchId, winner });

    const matchResult = await pool.query(
      `SELECT player1_id, player2_id FROM gebeta_matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }

    const match = matchResult.rows[0];
    const loserId = winner === match.player1_id ? match.player2_id : match.player1_id;

    await pool.query(
      `UPDATE gebeta_matches
       SET finished = TRUE,
           winner = $1,
           player1_score = $2,
           player2_score = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [winner, playerScore, opponentScore, matchId]
    );

    // Winner gets 20 coins
    if (winner) {
      await pool.query(
        `UPDATE users 
         SET coins = coins + 20
         WHERE id = $1`,
        [winner]
      );

      console.log(`💰 Winner ${winner} gets +20 coins`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Gebeta finish error:", err.message);
    res.status(500).json({ error: "Failed to finish match" });
  }
});

// ==========================================
// VOICE CHAT ENDPOINTS
// ==========================================

// Store active calls in memory (in production, use Redis)
const activeCalls = new Map();
const pendingCalls = new Map();

app.get("/api/users/available", authenticateToken, async (req, res) => {
  try {
    console.log(`🔍 User ${req.user.userId} requesting available users`);
    console.log(`   Username: ${req.user.username}`);
    
    const result = await pool.query(
      `SELECT id, username FROM users WHERE id != $1 ORDER BY username`,
      [req.user.userId]
    );
    
    console.log(`✅ Found ${result.rows.length} available user(s):`, result.rows.map(u => `${u.username} (ID: ${u.id})`).join(', '));
    
    if (result.rows.length === 0) {
      console.log('⚠️ No other users in database! Need to create more accounts.');
    }
    
    res.json({ users: result.rows });
  } catch (err) {
    console.error("❌ Get available users error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ error: "Failed to get users", details: err.message });
  }
});

// Test endpoint to see ALL users (for debugging)
app.get("/api/users/all", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, coins, created_at FROM users ORDER BY id`
    );
    
    console.log(`📊 Total users in database: ${result.rows.length}`);
    result.rows.forEach(u => {
      console.log(`   - ${u.username} (ID: ${u.id}, Coins: ${u.coins})`);
    });
    
    res.json({ 
      total: result.rows.length,
      users: result.rows,
      currentUser: req.user.userId
    });
  } catch (err) {
    console.error("❌ Get all users error:", err.message);
    res.status(500).json({ error: "Failed to get users" });
  }
});

app.post("/api/voice/call", authenticateToken, async (req, res) => {
  try {
    const { toUserId, offer } = req.body;
    const fromUserId = req.user.userId;

    const fromUser = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [fromUserId]
    );

    const callData = {
      id: `call_${Date.now()}`,
      fromUserId,
      fromUsername: fromUser.rows[0].username,
      toUserId,
      offer,
      status: 'pending',
      createdAt: new Date()
    };

    pendingCalls.set(toUserId, callData);
    console.log(`📞 Call from ${fromUserId} to ${toUserId}`);

    res.json({ success: true, callId: callData.id });
  } catch (err) {
    console.error("Call error:", err.message);
    res.status(500).json({ error: "Failed to initiate call" });
  }
});

app.get("/api/voice/check-call", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const call = pendingCalls.get(userId);

    if (call && call.status === 'pending') {
      res.json({ call });
    } else {
      res.json({ call: null });
    }
  } catch (err) {
    console.error("Check call error:", err.message);
    res.status(500).json({ error: "Failed to check calls" });
  }
});

app.get("/api/voice/call-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find call where user is the caller
    for (const [toUserId, call] of pendingCalls.entries()) {
      if (call.fromUserId === userId) {
        return res.json({ 
          status: call.status,
          answer: call.answer
        });
      }
    }

    res.json({ status: 'no-call' });
  } catch (err) {
    console.error("Call status error:", err.message);
    res.status(500).json({ error: "Failed to get call status" });
  }
});

app.post("/api/voice/answer", authenticateToken, async (req, res) => {
  try {
    const { callId, answer } = req.body;
    const userId = req.user.userId;

    const call = pendingCalls.get(userId);
    
    if (call && call.id === callId) {
      call.status = 'accepted';
      call.answer = answer;
      
      activeCalls.set(call.fromUserId, call);
      activeCalls.set(userId, call);
      
      console.log(`✅ Call answered: ${callId}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Call not found" });
    }
  } catch (err) {
    console.error("Answer call error:", err.message);
    res.status(500).json({ error: "Failed to answer call" });
  }
});

app.post("/api/voice/decline", authenticateToken, async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.userId;

    const call = pendingCalls.get(userId);
    
    if (call && call.id === callId) {
      call.status = 'declined';
      
      setTimeout(() => {
        pendingCalls.delete(userId);
      }, 5000);
      
      console.log(`❌ Call declined: ${callId}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Call not found" });
    }
  } catch (err) {
    console.error("Decline call error:", err.message);
    res.status(500).json({ error: "Failed to decline call" });
  }
});

app.post("/api/voice/end-call", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Remove from active and pending calls
    activeCalls.delete(userId);
    pendingCalls.delete(userId);

    // Also remove any calls where this user was the caller
    for (const [toUserId, call] of pendingCalls.entries()) {
      if (call.fromUserId === userId) {
        pendingCalls.delete(toUserId);
      }
    }

    console.log(`📞 Call ended by user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error("End call error:", err.message);
    res.status(500).json({ error: "Failed to end call" });
  }
});

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        coins INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create chat_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create tictactoe_invites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tictactoe_invites (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER REFERENCES users(id),
        to_user_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        match_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create tictactoe_matches table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tictactoe_matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER REFERENCES users(id),
        player2_id INTEGER REFERENCES users(id),
        board JSONB DEFAULT '${JSON.stringify(Array(9).fill(null))}'::jsonb,
        current_turn VARCHAR(1) DEFAULT 'X',
        winner VARCHAR(1),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create gebeta_invites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gebeta_invites (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER REFERENCES users(id),
        to_user_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        match_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create gebeta_matches table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gebeta_matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER REFERENCES users(id),
        player2_id INTEGER REFERENCES users(id),
        board JSONB DEFAULT '${JSON.stringify([4,4,4,4,4,4,4,4,4,4,4,4])}'::jsonb,
        player1_score INTEGER DEFAULT 0,
        player2_score INTEGER DEFAULT 0,
        current_player INTEGER,
        winner INTEGER,
        finished BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("✅ Database tables initialized");
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
  }
}

// Initialize database on startup
initializeDatabase();

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({
    message: "Parent-Child Game Platform API",
    version: "1.0.0",
    status: "running"
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`
  🎮 Parent-Child Game Platform
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Server: http://localhost:${PORT}
  💾 Database: PostgreSQL
  🎯 Games: Gebeta ✅ | Tic-Tac-Toe ✅
  💬 Chat: ✅
  👥 Multiplayer: ✅
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
