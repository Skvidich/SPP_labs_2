import { startTelemetry, shutdownTelemetry } from './telemetry.js';
import { createWorker, reportTotals } from './workerRunner.js';
import { createMusicBrainzAdapter } from './adapters/musicbrainz.js';
import { createItunesAdapter } from './adapters/itunes.js';
import { createAudiusAdapter } from './adapters/audius.js';
import { closePool } from './db.js';
import { stopControl } from './stopControl.js';
import { countTotal } from './batchWriter.js';
import { startMetricsServer, stopMetricsServer } from './metrics.js';
import { config } from './config.js';

console.log(`[collector] starting, stopLimit=${stopControl.limit}, batchSize=${config.batchSize}`);

startTelemetry();
await startMetricsServer();

const musicbrainz = createWorker('musicbrainz', createMusicBrainzAdapter());
const itunes = createWorker('itunes', createItunesAdapter());
const audius = createWorker('audius', createAudiusAdapter());

async function main() {
  // Все три воркера работают независимо и останавливаются по общему сигналу
  // (COUNT(*) > stopControl.limit) через stopControl.
  const results = await Promise.all([
    musicbrainz.run(),
    itunes.run(),
    audius.run(),
  ]);

  await reportTotals(results);

  const total = await countTotal();
  console.log(`[collector] final catalog.items = ${total}`);

  await stopMetricsServer();
  await shutdownTelemetry();
  await closePool();
  console.log('[collector] done');
}

main().catch(async (err) => {
  console.error('[collector] fatal error', err);
  try { await stopMetricsServer(); } catch { /* ignore */ }
  try { await shutdownTelemetry(); } catch { /* ignore */ }
  try { await closePool(); } catch { /* ignore */ }
  process.exit(1);
});