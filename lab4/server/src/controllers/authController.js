const { pool } = require('../config/db');

async function loginUser(req, res) {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }
  try {
    const trimmed = username.trim();
    let userRes = await pool.query('SELECT * FROM users WHERE username = $1', [trimmed]);
    let user;
    if (userRes.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (username) VALUES ($1) RETURNING *',
        [trimmed]
      );
      user = newUser.rows[0];
    } else {
      user = userRes.rows[0];
    }
    res.json(user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { loginUser };