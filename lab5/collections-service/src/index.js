import subgraph from '@apollo/subgraph';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { startTelemetry, shutdownTelemetry, extractIncomingContext } from './telemetry.js';
import { startMetricsServer, stopMetricsServer } from './metrics.js';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { config } from './config.js';
import { pool, closePool } from './db.js';
import { buildValidationRules, ERROR_CODE } from './depthLimit.js';
import { graphqlMetricsPlugin } from './apolloMetricsPlugin.js';

const { buildSubgraphSchema } = subgraph;

const logger = console;

function formatError(formattedError) {
  const code = formattedError.extensions?.code;
  const message = formattedError.message ?? '';
  if (code === 'BAD_USER_INPUT') {
    return {
      message,
      extensions: { code: 'BAD_USER_INPUT' },
    };
  }
  if (code === ERROR_CODE || message.startsWith('operation exceeds maximum allowed depth')) {
    return {
      message,
      extensions: { code: ERROR_CODE },
    };
  }
  if (code === 'GRAPHQL_VALIDATION_FAILED' || (code === undefined && formattedError.path === undefined)) {
    return {
      message,
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    };
  }
  return {
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}

const schema = buildSubgraphSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  validationRules: buildValidationRules(),
  plugins: [graphqlMetricsPlugin()],
  formatError,
  // Subgraph должен быть интроспектируемым: Apollo Gateway обращается к
  // `_service`/`_entities` при построении суперграфа. Отключать нельзя.
  introspection: true,
});

async function main() {
  startTelemetry();
  await startMetricsServer();

  if (config.nodeEnv === 'production') {
    // Проверяем доступность PostgreSQL до публикации порта, чтобы
    // healthcheck Compose не заканчивался успехом на неготовой БД.
    await pool.query('SELECT 1');
  }

  const { url } = await startStandaloneServer(server, {
    listen: { port: config.port, host: '0.0.0.0' },
    context: async ({ req }) => ({
      // Извлекаем traceparent из входящего запроса gateway; резолверы
      // используют его как родителя span'ов, чтобы трейс был сквозным.
      __otelParentContext: extractIncomingContext(req?.headers),
    }),
  });

  logger.log(`[collections-service] Apollo subgraph ready at ${url}`);
}

async function shutdown(signal) {
  logger.log(`[collections-service] ${signal} received, shutting down`);
  try {
    await server.stop();
  } catch (e) {
    logger.warn('[collections-service] server stop failed:', e?.message);
  }
  try {
    await stopMetricsServer();
  } catch { /* ignore */ }
  try {
    await shutdownTelemetry();
  } catch { /* ignore */ }
  try {
    await closePool();
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch(async (err) => {
  logger.error('[collections-service] fatal error', err.message);
  try { await server.stop(); } catch { /* ignore */ }
  try { await stopMetricsServer(); } catch { /* ignore */ }
  try { await shutdownTelemetry(); } catch { /* ignore */ }
  try { await closePool(); } catch { /* ignore */ }
  process.exit(1);
});