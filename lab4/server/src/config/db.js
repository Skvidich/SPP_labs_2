const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL
  || 'postgres://postgres:postgres@postgres:5432/coin_rush';

// Render требует SSL только для внешних подключений.
// Внутренние (dpg-xxx-a) работают без него.
const useSSL = connectionString.includes('render.com')
  || connectionString.includes('sslmode=require');

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  let retries = 5;
  while (retries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_results (
          id SERIAL PRIMARY KEY,
          game_id INT REFERENCES games(id) ON DELETE CASCADE,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          score INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_game_user UNIQUE (game_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_results_game ON game_results(game_id);
        CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id);
      `);
      console.log('✅ DB schema ready');
      break;
    } catch (err) {
      retries--;
      console.log(`DB not ready. Retries left: ${retries}. ${err.message}`);
      if (retries === 0) { process.exit(1); }
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

module.exports = { pool, initDB };