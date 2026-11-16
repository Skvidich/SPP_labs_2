import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4002),
  metricsPort: Number(process.env.METRICS_PORT ?? 9102),
  graphqlTimeoutMs: Number(process.env.COLLECTIONS_GRAPHQL_TIMEOUT_MS ?? 15000),
  catalogUrl: process.env.CATALOG_URL ?? 'http://catalog-service:4001',
  catalogCheckTimeoutMs: Number(process.env.COLLECTIONS_CATALOG_CHECK_TIMEOUT_MS ?? 3000),
  db: {
    url: process.env.DATABASE_URL ?? 'postgresql://music:music@localhost:5432/music_db',
    statementTimeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  },
};