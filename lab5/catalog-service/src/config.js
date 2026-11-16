import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4001),
  metricsPort: Number(process.env.METRICS_PORT ?? 9101),
  maxPageSize: Number(process.env.CATALOG_MAX_PAGE_SIZE ?? 100),
  graphqlTimeoutMs: Number(process.env.CATALOG_GRAPHQL_TIMEOUT_MS ?? 15000),
  db: {
    url: process.env.DATABASE_URL ?? 'postgresql://music:music@localhost:5432/music_db',
    statementTimeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15000),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  },
};