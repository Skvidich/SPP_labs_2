import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.max,
  statement_timeout: config.db.statementTimeout,
});

pool.on('error', (err) => {
  console.error('[db] pool error', err.message);
});

export async function closePool() {
  await pool.end();
}