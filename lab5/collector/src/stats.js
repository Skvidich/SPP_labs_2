import {
  incWorkerCounter,
  setWorkerFinished,
  markWorkerFetch,
  observeDuration,
} from './metrics.js';

export class WorkerStats {
  constructor(name) {
    this.name = name;
    this.requests = 0;
    this.rowsFetched = 0;
    this.rowsInserted = 0;
    this.rowsUpdated = 0;
    this.rowsSaved = 0;
    this.relationsSaved = 0;
    this.batchesSaved = 0;
    this.errors = 0;
    this.retries = 0;
    this.finished = false;
  }

  recordRequest() {
    this.requests += 1;
    incWorkerCounter(this.name, 'requests');
  }

  recordFetched(rows) {
    this.rowsFetched += rows;
    incWorkerCounter(this.name, 'rowsFetched', rows);
    markWorkerFetch(this.name);
  }

  recordSaved(rows, relations, { inserted = rows, updated = 0 } = {}) {
    this.rowsInserted += inserted;
    this.rowsUpdated += updated;
    this.rowsSaved += rows;
    this.relationsSaved += (relations ?? 0);
    this.batchesSaved += 1;
    incWorkerCounter(this.name, 'rowsInserted', inserted);
    incWorkerCounter(this.name, 'rowsUpdated', updated);
    incWorkerCounter(this.name, 'rowsSaved', rows);
    incWorkerCounter(this.name, 'relationsSaved', relations ?? 0);
    incWorkerCounter(this.name, 'batchesSaved');
  }

  recordError() {
    this.errors += 1;
    incWorkerCounter(this.name, 'errors');
  }

  recordRetry() {
    this.retries += 1;
    incWorkerCounter(this.name, 'retries');
  }

  recordDuration(phase, seconds) {
    observeDuration(this.name, phase, seconds);
  }

  markFinished() {
    if (this.finished) return;
    this.finished = true;
    setWorkerFinished(this.name, true);
  }

  snapshot() {
    return { ...this };
  }
}

export function formatStats(stats) {
  return Object.fromEntries(
    stats.map((s) => [s.name, s.snapshot()])
  );
}