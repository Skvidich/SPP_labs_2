import { writeBatch, makeBatches, countTotal } from './batchWriter.js';
import { stopControl } from './stopControl.js';
import { createLogger } from './logger.js';
import { WorkerStats } from './stats.js';
import { sleep } from './rateLimit.js';
import { registerWorker } from './metrics.js';
import { tracePhase } from './telemetry.js';

/**
 * Runs one continuously-polling worker.
 * adapter.fetch() must return { items, relations } (normalized) or null when the
 * current pass over the source is exhausted. Returns items in arbitrary sizes;
 * the runner chunks them into configured batches and writes each in a transaction.
 * adapter.resumeCycle() is called when a pass is exhausted and the global limit
 * has not yet been reached, so the collector keeps polling without interruption.
 */
export function createWorker(name, adapter) {
  const stats = new WorkerStats(name);
  const log = createLogger(name);
  const MAX_WRITE_ATTEMPTS = 3;
  registerWorker(name, stats);

  async function backoff(reason) {
    const backoff = Math.min(5000, 1000 * Math.pow(2, Math.min(Math.max(stats.errors, 1), 4)));
    log.warn(`${reason}, retrying in ${backoff}ms`);
    stats.recordRetry();
    await sleep(backoff);
  }

  async function run() {
    log.info('worker started');
    if (typeof adapter.attachStats === 'function') {
      adapter.attachStats(stats);
    }
    try {
      while (!stopControl.shouldStop()) {
        let page;
        try {
          stats.recordRequest();
          const start = Date.now();
          page = await tracePhase(name, 'fetch', () => adapter.fetch());
          stats.recordDuration('fetch', (Date.now() - start) / 1000);
        } catch (err) {
          stats.recordError();
          log.error('fetch error', { error: err.message, status: err.status ?? '' });
          await backoff('temporary fetch error');
          continue;
        }

        if (!page || (page.items && page.items.length === 0)) {
          if (stopControl.shouldStop()) break;
          try {
            adapter.resumeCycle();
          } catch (err) {
            stats.recordError();
            log.error('cycle resume failed', { error: err.message });
          }
          continue;
        }

        const batches = makeBatches(page.items, page.relations ?? []);
        const source = page.source ?? name;

        for (const batch of batches) {
          if (stopControl.shouldStop()) break;
          if (batch.items.length === 0) continue;

          for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
            try {
              const start = Date.now();
              const result = await tracePhase(name, 'write', () => writeBatch(batch, { source }));
              stats.recordDuration('write', (Date.now() - start) / 1000);
              stats.recordSaved(
                result.rowsSaved,
                result.relationsSaved,
                { inserted: result.rowsInserted, updated: result.rowsUpdated }
              );
              log.info(`batch written: +${result.rowsSaved} items, ${result.relationsSaved} relations, total=${result.total}`);
              if (result.stopped) {
                log.info(`stop limit reached (${result.total} > ${stopControl.limit})`);
                return stats;
              }
              break;
            } catch (err) {
              stats.recordError();
              log.error(`batch write failed (attempt ${attempt}/${MAX_WRITE_ATTEMPTS})`, { error: err.message });
              if (attempt < MAX_WRITE_ATTEMPTS) {
                await backoff('temporary write error');
              }
            }
          }
        }
      }
    } finally {
      stats.markFinished();
      log.info('worker stopped');
    }
    return stats;
  }

  function snapshot() {
    return stats.snapshot();
  }

  return { name, run, snapshot, stats };
}

export async function reportTotals(finalStats) {
  let total = 0;
  try {
    total = await countTotal();
  } catch (err) {
    console.error('[collector] failed to read final total', err.message);
  }
  const lines = ['--- final report ---', `total rows (catalog.items): ${total}`];
  for (const s of finalStats) {
    const snap = s.snapshot();
    lines.push(
      `[${s.name}] requests=${snap.requests} fetched=${snap.rowsFetched} inserted=${snap.rowsInserted} updated=${snap.rowsUpdated} saved=${snap.rowsSaved} relations=${snap.relationsSaved} batches=${snap.batchesSaved} errors=${snap.errors} retries=${snap.retries} finished=${snap.finished}`
    );
  }
  console.log(lines.join('\n'));
}