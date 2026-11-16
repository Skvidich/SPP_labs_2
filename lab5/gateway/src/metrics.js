import http from 'node:http';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { config } from './config.js';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const gqlRequests = new Counter({
  name: 'gateway_graphql_requests_total',
  help: 'Total GraphQL requests handled by the Apollo Gateway.',
  labelNames: ['operation'],
  registers: [registry],
});

const gqlErrors = new Counter({
  name: 'gateway_graphql_errors_total',
  help: 'Total GraphQL requests that returned errors.',
  labelNames: ['operation'],
  registers: [registry],
});

const gqlDuration = new Histogram({
  name: 'gateway_graphql_duration_seconds',
  help: 'Duration of GraphQL requests, in seconds.',
  labelNames: ['operation'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const fetchErrors = new Counter({
  name: 'gateway_subgraph_fetch_errors_total',
  help: 'Total errors reaching subgraphs (proxy fetch failures to Catalog/Collections).',
  labelNames: ['operation'],
  registers: [registry],
});

const subgraphDuration = new Histogram({
  name: 'gateway_subgraph_duration_seconds',
  help: 'Duration of subgraph fetch operations (proxy to Catalog/Collections).',
  labelNames: ['operation'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
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

export function observeSubgraphDuration(operation, seconds) {
  subgraphDuration.labels(operation).observe(seconds);
}

export function observeSubgraphError(operation) {
  fetchErrors.labels(operation).inc();
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