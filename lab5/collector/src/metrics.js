import http from 'node:http';
import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { config } from './config.js';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const counters = new Map();
const gauges = new Map();

function workerCounter(name, help) {
  const counter = new Counter({
    name,
    help,
    labelNames: ['worker'],
    registers: [registry],
  });
  return counter;
}

function workerGauge(name, help) {
  const gauge = new Gauge({
    name,
    help,
    labelNames: ['worker'],
    registers: [registry],
  });
  return gauge;
}

function defineMetrics() {
  if (counters.size > 0) return;

  counters.set('requests', workerCounter(
    'collector_worker_requests_total',
    'Total HTTP requests performed by the worker.'
  ));
  counters.set('rowsFetched', workerCounter(
    'collector_worker_rows_fetched_total',
    'Records received from the source.'
  ));
  counters.set('rowsInserted', workerCounter(
    'collector_worker_rows_inserted_total',
    'Records inserted into catalog.items.'
  ));
  counters.set('rowsUpdated', workerCounter(
    'collector_worker_rows_updated_total',
    'Records updated (deduplicated) in catalog.items.'
  ));
  counters.set('rowsSaved', workerCounter(
    'collector_worker_rows_saved_total',
    'Records written to catalog.items (inserts + updates).'
  ));
  counters.set('relationsSaved', workerCounter(
    'collector_worker_relations_saved_total',
    'Artist-track relations written to catalog.item_relations.'
  ));
  counters.set('batchesSaved', workerCounter(
    'collector_worker_batches_saved_total',
    'Batches committed in a transaction.'
  ));
  counters.set('errors', workerCounter(
    'collector_worker_errors_total',
    'Total errors (fetch or batch write).'
  ));
  counters.set('retries', workerCounter(
    'collector_worker_retries_total',
    'Total retries after temporary failures.'
  ));

  gauges.set('finished', workerGauge(
    'collector_worker_finished',
    '1 when the worker has stopped, else 0.'
  ));
  gauges.set('lastFetchAt', workerGauge(
    'collector_worker_last_fetch_unix_ts',
    'Unix timestamp of the last successful adapter.fetch().'
  ));
}

const durations = new Histogram({
  name: 'collector_worker_duration_seconds',
  help: 'Duration of fetch and batch write phases, in seconds.',
  labelNames: ['worker', 'phase'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

const totalGauge = new Gauge({
  name: 'collector_catalog_total_items',
  help: 'Total rows currently in catalog.items.',
  registers: [registry],
});

const workers = new Map();

export function registerWorker(name, stats) {
  defineMetrics();
  workers.set(name, stats);

  // Публикуем начальные нули, чтобы воркер был виден в Grafana до первого цикла.
  for (const [, counter] of counters) counter.labels(name).inc(0);
  gauges.get('finished').labels(name).set(0);
  gauges.get('lastFetchAt').labels(name).set(0);
}

export function setTotal(total) {
  totalGauge.set(total);
}

export function observeDuration(name, phase, seconds) {
  durations.labels(name, phase).observe(seconds);
}

// Инкрементальные обновления Prometheus-метрик из WorkerStats.
// Каждое событие отражается немедленно, а не на следующем scrape.

export function incWorkerCounter(name, key, amount = 1) {
  const counter = counters.get(key);
  if (counter) counter.labels(name).inc(amount);
}

export function setWorkerFinished(name, finished) {
  gauges.get('finished').labels(name).set(finished ? 1 : 0);
}

export function markWorkerFetch(name) {
  gauges.get('lastFetchAt').labels(name).set(Math.floor(Date.now() / 1000));
}

export function scrapeValues() {
  for (const [, gauge] of gauges) {
    // Все состояние-гауги уже обновляются инкрементально из воркеров;
    // ничего перезаписывать на scrape не нужно.
    void gauge;
  }
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
    server.listen(config.metrics.port, '0.0.0.0', () => {
      server.removeListener('error', reject);
      console.log(`[metrics] Prometheus endpoint listening on :${config.metrics.port}/metrics`);
      resolve();
    });
  });
}

export async function stopMetricsServer() {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
  server = undefined;
}