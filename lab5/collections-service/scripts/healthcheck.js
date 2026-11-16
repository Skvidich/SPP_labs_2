import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const metricsPort = Number(process.env.METRICS_PORT ?? 9102);

async function checkHttp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`http://127.0.0.1:${metricsPort}/metrics`, {
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function checkDb() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://music:music@localhost:5432/music_db',
    max: 1,
    statement_timeout: 2000,
  });
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } finally {
    await pool.end();
  }
}

const http = await checkHttp();
const db = await checkDb();

if (!http || !db) {
  console.error(`[healthcheck] unhealthy http=${http} db=${db}`);
  process.exit(1);
}
console.log(`[healthcheck] healthy http=${http} db=${db}`);
process.exit(0);