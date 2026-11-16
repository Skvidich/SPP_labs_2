import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { startTelemetry, shutdownTelemetry } from './telemetry.js';
import { startMetricsServer, stopMetricsServer } from './metrics.js';
import { config } from './config.js';
import { buildValidationRules, ERROR_CODE } from './depthLimit.js';
import { graphqlMetricsPlugin } from './apolloMetricsPlugin.js';
import { gatewayTracePlugin } from './gatewayTracePlugin.js';
import { GatewayTraceDataSource } from './gatewayTraceDatasource.js';

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
  // Federation-ошибки (например, недоступность subgraph) не раскрывают внутренние детали.
  return {
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}

function gatewayLogger(errors) {
  for (const error of errors) {
    if (error.extensions?.code === ERROR_CODE) continue;
    logger.warn('[gateway] service error:', error.message);
  }
}

const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { name: 'catalog', url: config.catalogUrl },
      { name: 'collections', url: config.collectionsUrl },
    ],
    // IntrospectAndCompose периодически (по умолчанию 10с) переопрашивает
    // subgraph. В раздельных SQL-схемах сабграф завершает интроспекцию быстро.
  }),
  // Распространение trace-контекста в subgraph: исходящие запросы получают
  // заголовок traceparent через GatewayTraceDataSource.willSendRequest.
  buildService({ name, url }) {
    return new GatewayTraceDataSource({ url });
  },
  logger: logger,
  // __resolveReference для сущностей выполняется внутри subgraph; Gateway сам
  // не добавляет прямых таймаутов на резолверы, но ограничение глубины и
  // таймаут обработки применяются выше.
});

const server = new ApolloServer({
  gateway,
  validationRules: buildValidationRules(),
  plugins: [graphqlMetricsPlugin(), gatewayTracePlugin()],
  formatError,
  // CSRF prevention выключено: единственный клиент — собственный фронтенд,
  // который ходит в /graphql через nginx (same-origin). urql использует GET
  // для query-операций, которые Apollo по умолчанию блокирует как CSRF.
  csrfPrevention: false,
  // Gateway публикует суперграф клиентам: ClientIntrospection обязательна.
  introspection: true,
});

async function main() {
  startTelemetry();
  await startMetricsServer();

  const { url } = await startStandaloneServer(server, {
    listen: { port: config.port, host: '0.0.0.0' },
  });

  logger.log(`[gateway] Apollo Gateway ready at ${url}`);
  logger.log(
    `[gateway] subgraphs: catalog=${config.catalogUrl}, collections=${config.collectionsUrl}`
  );
}

async function shutdown(signal) {
  logger.log(`[gateway] ${signal} received, shutting down`);
  try {
    await server.stop();
  } catch (e) {
    logger.warn('[gateway] server stop failed:', e?.message);
  }
  try {
    await stopMetricsServer();
  } catch { /* ignore */ }
  try {
    await shutdownTelemetry();
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch(async (err) => {
  const errors = err?.errors;
  if (Array.isArray(errors) && errors.length) {
    gatewayLogger(errors);
  } else {
    logger.error('[gateway] fatal error', err?.message ?? err);
  }
  try { await server.stop(); } catch { /* ignore */ }
  try { await stopMetricsServer(); } catch { /* ignore */ }
  try { await shutdownTelemetry(); } catch { /* ignore */ }
  process.exit(1);
});