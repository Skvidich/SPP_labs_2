import { pool } from './db.js';
import { stopControl } from './stopControl.js';
import { config } from './config.js';
import { setTotal } from './metrics.js';

const batchSize = config.batchSize;

// Подсчёт total выполняется с интервалом, чтобы не делать полный COUNT(*)
// на каждый батч (таблица растёт, COUNT(*) — O(n)).
const TOTAL_RECOUNT_INTERVAL = 50;

const INSERT_ITEM = `
  INSERT INTO catalog.items (type, title, source, source_id, description, url, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (source, source_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING (xmax = 0) AS inserted
`;

// Разрешённый источник, чтобы исключить правку чужих строк по (source, source_id).
const REL_LOOKUP = `
  SELECT id, source_id, type
  FROM catalog.items
  WHERE source = $1 AND source_id = ANY($2)
`;

const COUNT_ITEMS = 'SELECT COUNT(*)::int AS total FROM catalog.items';

/**
 * Writes one normalized batch in a single transaction.
 * batch: { items: NormalizedItem[], relations: {parentSourceId, childSourceId}[] }
 * NormalizedItem: { type, title, source, sourceId, description?, url?, metadata }
 *
 * @returns {Promise<{rowsInserted:number, rowsUpdated:number, rowsSaved:number, relationsSaved:number, total:number, stopped:boolean}>}
 */
export async function writeBatch(batch, { source } = {}) {
  if (!batch.items || batch.items.length === 0) {
    return { rowsInserted: 0, rowsUpdated: 0, rowsSaved: 0, relationsSaved: 0, total: stopControl.total, stopped: stopControl.stop };
  }
  if (batch.items.length > batchSize) {
    throw new Error(`batch too large: ${batch.items.length} > ${batchSize}`);
  }

  const client = await pool.connect();
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let relationsSaved = 0;

  try {
    await client.query('BEGIN');

    for (const item of batch.items) {
      const { rows } = await client.query(INSERT_ITEM, [
        item.type,
        item.title,
        item.source,
        item.sourceId,
        item.description ?? null,
        item.url ?? null,
        JSON.stringify(item.metadata ?? {}),
      ]);
      if (rows[0]?.inserted) rowsInserted += 1;
      else rowsUpdated += 1;
    }

    if (batch.relations && batch.relations.length > 0) {
      const relIds = await resolveRelations(client, batch.relations, source);
      for (const [parentId, childId] of relIds) {
        if (!parentId || !childId) continue;
        await client.query(
          'INSERT INTO catalog.item_relations (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [parentId, childId]
        );
        relationsSaved += 1;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }

  // Полный COUNT(*) — только периодически; между пересчётами используем
  // последнее известное значение + накопленную локальную дельту.
  let total = stopControl.total;
  if (stopControl.recountCounter >= TOTAL_RECOUNT_INTERVAL) {
    const { rows } = await pool.query(COUNT_ITEMS);
    total = rows[0]?.total ?? 0;
    stopControl.recountCounter = 0;
  } else {
    total += rowsInserted;
  }
  stopControl.recountCounter += 1;
  setTotal(total);

  const stopped = stopControl.setTotal(total);

  return { rowsInserted, rowsUpdated, rowsSaved: rowsInserted + rowsUpdated, relationsSaved, total, stopped };
}

async function resolveRelations(client, relations, source) {
  const ids = new Set();
  for (const rel of relations) {
    ids.add(rel.parentSourceId);
    ids.add(rel.childSourceId);
  }
  const { rows } = await client.query(REL_LOOKUP, [source, [...ids]]);
  const idBySource = new Map();
  for (const row of rows) idBySource.set(row.source_id, row.id);

  const pairs = [];
  for (const rel of relations) {
    const parentId = idBySource.get(rel.parentSourceId);
    const childId = idBySource.get(rel.childSourceId);
    if (parentId && childId) pairs.push([parentId, childId]);
  }
  return pairs;
}

export async function countTotal() {
  const { rows } = await pool.query(COUNT_ITEMS);
  return rows[0]?.total ?? 0;
}

/**
 * Splits a flat item list into batches of up to batchSize items.
 * Relations are resolved inside writeBatch against the DB, so they are passed
 * to every batch that touches the current source; deduping is handled there.
 */
export function makeBatches(items, relations) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push({ items: items.slice(i, i + batchSize), relations: relations ?? [] });
  }
  return batches;
}