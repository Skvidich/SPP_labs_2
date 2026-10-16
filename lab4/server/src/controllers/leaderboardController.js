const { pool } = require('../config/db');

async function getLeaderboard(req, res) {
  try {
    const overall = await pool.query(`
      SELECT u.username,
             SUM(gr.score)::int AS total_score,
             COUNT(*)::int AS games_played
      FROM game_results gr
      JOIN users u ON u.id = gr.user_id
      GROUP BY u.id, u.username
      ORDER BY total_score DESC
      LIMIT 10
    `);
    res.json({ overall: overall.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getLeaderboard };