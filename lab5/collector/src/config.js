import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  stopLimit: Number(process.env.COLLECTOR_STOP_LIMIT ?? 10000),
  batchSize: Number(process.env.COLLECTOR_BATCH_SIZE ?? 100),
  metrics: {
    port: Number(process.env.COLLECTOR_METRICS_PORT ?? 9120),
  },
  db: {
    url: process.env.DATABASE_URL ?? 'postgresql://music:music@localhost:5432/music_db',
    statementTimeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  },
  http: {
    timeoutMs: Number(process.env.COLLECTOR_HTTP_TIMEOUT_MS ?? 20000),
  },
};

export const sources = {
  musicbrainz: {
    baseUrl: process.env.MB_API_URL ?? 'https://musicbrainz.org/ws/2',
    rateMs: Number(process.env.MB_RATE_MS ?? 1200),
    minRateMs: Number(process.env.MB_MIN_RATE_MS ?? 1100),
    concurrency: Number(process.env.MB_CONCURRENCY ?? 1),
  },
  itunes: {
    baseUrl: process.env.ITUNES_API_URL ?? 'https://itunes.apple.com',
    rateMs: Number(process.env.ITUNES_RATE_MS ?? 1500),
    concurrency: Number(process.env.ITUNES_CONCURRENCY ?? 1),
  },
  audius: {
    baseUrl: process.env.AUDIUS_API_URL ?? 'https://api.audius.co',
    rateMs: Number(process.env.AUDIUS_RATE_MS ?? 900),
    concurrency: Number(process.env.AUDIUS_CONCURRENCY ?? 1),
  },
};