import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  metricsPort: Number(process.env.METRICS_PORT ?? 9100),
  graphqlTimeoutMs: Number(process.env.GATEWAY_GRAPHQL_TIMEOUT_MS ?? 15000),
  catalogUrl: process.env.CATALOG_URL ?? 'http://127.0.0.1:4001',
  collectionsUrl: process.env.COLLECTIONS_URL ?? 'http://127.0.0.1:4002',
};