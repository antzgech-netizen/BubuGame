require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ---------- Database ----------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        coins INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Chat messages (global / existing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // TicTacToe invites
    await client.query(`
      CREATE TABLE IF NOT EXISTS tictactoe_invites (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // TicTacToe matches
    await client.query(`
      CREATE TABLE IF NOT EXISTS tictactoe_matches (
        id SERIAL PRIMARY KEY,
        player_x_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player_o_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_state VARCHAR(9) NOT NULL DEFAULT '_________',
        current_turn VARCHAR(1) NOT NULL DEFAULT 'X',
        winner VARCHAR(1),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Gebeta invites
    await client.query(`
      CREATE TABLE IF NOT EXISTS gebeta_invites (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Gebeta matches
    await client.query(`
      CREATE TABLE IF NOT EXISTS gebeta_matches (
        id SERIAL PRIMARY KEY,
        player_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        player_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_state JSONB NOT NULL,
        current_turn INTEGER NOT NULL DEFAULT 1,
        winner INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Mini‑World players
    await client.query(`
      CREATE TABLE IF NOT EXISTS mini_world_players (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        last_active TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (user_id)
      );
    `);

    // Mini‑World coins
    await client.query(`
      CREATE TABLE IF NOT EXISTS mini_world_coins (
        id SERIAL PRIMARY KEY,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        is_collected BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    // Mini‑World chat
    await client.query(`
      CREATE TABLE IF NOT EXISTS mini_world_chat (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', err);
  } finally {
    client.release();
  }
}

// ---------- Middleware ----------

app.use(cors());
app.use(express.json());

// Auth middleware (JWT)
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// ---------- Auth Routes ----------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || password.length < 4) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existing.rowCount > 0) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, coins)
       VALUES ($1, $2, $3)
       RETURNING id, username, coins`,
      [username, passwordHash, 0]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT id, username, password_hash, coins FROM users WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        coins: user.coins,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ---------- Mini‑World Routes ----------

// Get world state
app.get('/api/mini-world/state', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure player row exists
    await pool.query(
      `INSERT INTO mini_world_players (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const [playerRes, othersRes, coinsRes, chatRes] = await Promise.all([
      pool.query(
        'SELECT user_id, x, y FROM mini_world_players WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        `SELECT mwp.user_id, mwp.x, mwp.y, u.username
         FROM mini_world_players mwp
         JOIN users u ON u.id = mwp.user_id
         WHERE mwp.user_id <> $1
           AND mwp.last_active > NOW() - INTERVAL '2 minutes'`,
        [userId]
      ),
      pool.query(
        'SELECT id, x, y, is_collected FROM mini_world_coins WHERE is_collected = FALSE'
      ),
      pool.query(
        `SELECT mwc.id, mwc.message, mwc.created_at, u.username
         FROM mini_world_chat mwc
         JOIN users u ON u.id = mwc.user_id
         ORDER BY mwc.created_at DESC
         LIMIT 30`
      )
    ]);

    res.json({
      success: true,
      player: playerRes.rows[0],
      others: othersRes.rows,
      coins: coinsRes.rows,
      chat: chatRes.rows.reverse(),
    });
  } catch (err) {
    console.error('MiniWorld /state error:', err);
    res.status(500).json({ success: false, message: 'Failed to load world state' });
  }
});

// Move player
app.post('/api/mini-world/move', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dx, dy } = req.body;

    const moveX = Math.max(-1, Math.min(1, dx || 0));
    const moveY = Math.max(-1, Math.min(1, dy || 0));

    const result = await pool.query(
      `UPDATE mini_world_players
       SET x = x + $1,
           y = y + $2,
           last_active = NOW()
       WHERE user_id = $3
       RETURNING user_id, x, y`,
      [moveX, moveY, userId]
    );

    res.json({ success: true, player: result.rows[0] });
  } catch (err) {
    console.error('MiniWorld /move error:', err);
    res.status(500).json({ success: false, message: 'Failed to move player' });
  }
});

// Collect coin
app.post('/api/mini-world/collect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { coinId } = req.body;

    const result = await pool.query(
      `UPDATE mini_world_coins
       SET is_collected = TRUE
       WHERE id = $1 AND is_collected = FALSE
       RETURNING id`,
      [coinId]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'Coin already collected' });
    }

    await pool.query(
      `UPDATE users
       SET coins = coins + 1
       WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, collectedCoinId: coinId });
  } catch (err) {
    console.error('MiniWorld /collect error:', err);
    res.status(500).json({ success: false, message: 'Failed to collect coin' });
  }
});

// Send chat message
app.post('/api/mini-world/chat', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message required' });
    }

    const result = await pool.query(
      `INSERT INTO mini_world_chat (user_id, message)
       VALUES ($1, $2)
       RETURNING id, message, created_at`,
      [userId, message.trim()]
    );

    res.json({ success: true, chat: result.rows[0] });
  } catch (err) {
    console.error('MiniWorld /chat POST error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Get chat only
app.get('/api/mini-world/chat', authMiddleware, async (req, res) => {
  try {
    const chatRes = await pool.query(
      `SELECT mwc.id, mwc.message, mwc.created_at, u.username
       FROM mini_world_chat mwc
       JOIN users u ON u.id = mwc.user_id
       ORDER BY mwc.created_at DESC
       LIMIT 30`
    );
    res.json({ success: true, chat: chatRes.rows.reverse() });
  } catch (err) {
    console.error('MiniWorld /chat GET error:', err);
    res.status(500).json({ success: false, message: 'Failed to load chat' });
  }
});

// ---------- Root ----------

app.get('/', (req, res) => {
  res.send('Bubu Game Server with Mini‑World is running');
});

// ---------- Start ----------

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
});
