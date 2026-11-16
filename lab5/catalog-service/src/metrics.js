import http from 'node:http';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { config } from './config.js';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const gqlRequests = new Counter({
  name: 'catalog_graphql_requests_total',
  help: 'Total GraphQL requests handled by the Catalog Service.',
  labelNames: ['operation'],
  registers: [registry],
});

const gqlErrors = new Counter({
  name: 'catalog_graphql_errors_total',
  help: 'Total GraphQL requests that returned errors.',
  labelNames: ['operation'],
  registers: [registry],
});

const gqlDuration = new Histogram({
  name: 'catalog_graphql_duration_seconds',
  help: 'Duration of GraphQL requests, in seconds.',
  labelNames: ['operation'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const sqlDuration = new Histogram({
  name: 'catalog_sql_duration_seconds',
  help: 'Duration of SQL queries against PostgreSQL, in seconds.',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const sqlErrors = new Counter({
  name: 'catalog_sql_errors_total',
  help: 'Total SQL queries that failed against PostgreSQL.',
  labelNames: ['operation'],
  registers: [registry],
});

export function observeGqlRequest(operation) {
  gqlRequests.labels(operation).inc();
}

export function observeGqlError(operation) {
  gqlErrors.labels(operation).inc();
}

export function observeGqlDuration(operation, seconds) {
  gqlDuration.labels(operation).observe(seconds);
}

export function observeSqlDuration(operation, seconds) {
  sqlDuration.labels(operation).observe(seconds);
}

export function observeSqlError(operation) {
  sqlErrors.labels(operation).inc();
}

let server;

export function startMetricsServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && (req.url === '/metrics' || req.url === '/metrics/')) {
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(await registry.metrics());
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    server.once('error', reject);
    server.listen(config.metricsPort, '0.0.0.0', () => {
      server.removeListener('error', reject);
      console.log(`[metrics] Prometheus endpoint listening on :${config.metricsPort}/metrics`);
      resolve();
    });
  });
}

export async function stopMetricsServer() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
}