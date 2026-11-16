import { validate as isValidUuid } from 'uuid';
import { pool } from './db.js';
import { tracePhase } from './telemetry.js';
import { observeSqlDuration, observeSqlError } from './metrics.js';
import { config } from './config.js';

async function query(label, text, params) {
  const start = process.hrtime.bigint();
  try {
    return await pool.query(text, params);
  } catch (err) {
    observeSqlError(label);
    throw err;
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    observeSqlDuration(label, ms / 1000);
  }
}

// Список допустимых полей для ORDER BY. Всё остальное отклоняется до
// выполнения SQL (защита от произвольной сортировки и SQL-инъекций).
// Принимаются camelCase-имена полей GraphQL (createdAt/updatedAt) и
// snake_case-имена столбцов БД (created_at/updated_at); оба мапятся на
// реальные столбцы.
const SORT_COLUMNS = new Set([
  'title',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'source',
]);

const SORT_DIRECTIONS = new Set(['asc', 'desc']);

// Маппинг допустимых имён (как GraphQL camelCase, так и snake_case) на
// реальные столбцы БД для безопасной подстановки в ORDER BY.
const SORT_COLUMN_MAP = {
  title: 'title',
  created_at: 'created_at',
  createdAt: 'created_at',
  updated_at: 'updated_at',
  updatedAt: 'updated_at',
  source: 'source',
};

const SOURCES = new Set(['musicbrainz', 'itunes', 'audius']);

function normalizePage({ limit, offset }) {
  const size =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, config.maxPageSize) : 20;
  const off = Number.isInteger(offset) && offset > 0 ? offset : 0;
  return { size, off };
}

function normalizeSort(sort) {
  if (!sort) return { column: 'title', direction: 'asc' };
  const column = typeof sort.field === 'string' ? sort.field : 'title';
  const direction = typeof sort.direction === 'string' ? sort.direction.toLowerCase() : 'asc';
  if (!SORT_COLUMNS.has(column)) {
    throw new UserInputError(`sort field "${column}" is not allowed`);
  }
  if (!SORT_DIRECTIONS.has(direction)) {
    throw new UserInputError(`sort direction "${direction}" is not allowed`);
  }
  return { column: SORT_COLUMN_MAP[column], direction };
}

function normalizeSource(source) {
  if (source == null) return null;
  if (!SOURCES.has(source)) {
    throw new UserInputError(`source "${source}" is not allowed`);
  }
  return source;
}

// Вычисляет WHERE-условия и параметры для типового списочного запроса.
// Возвращает объект с массивом условий и параметрами; LIMIT/OFFSET добавляются
// вызывающим кодом после.
function buildListQuery({ type, search, source }) {
  const where = ['type = $1'];
  const params = [type];

  if (search && String(search).trim().length > 0) {
    params.push(`%${String(search).trim()}%`);
    where.push(`title ILIKE $${params.length}`);
  }

  if (source) {
    params.push(source);
    where.push(`source = $${params.length}`);
  }

  return { where, params };
}

export class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserInputError';
    this.extensions = { code: 'BAD_USER_INPUT' };
  }
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    source: row.source,
    sourceId: row.source_id,
    description: row.description,
    url: row.url,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findArtistById(id) {
  if (!isValidUuid(id)) return null;
  return tracePhase('repo', 'findArtistById', async () => {
    const { rows } = await query(
      'findArtistById',
      'SELECT * FROM catalog.items WHERE id = $1 AND type = $2',
      [id, 'artist']
    );
    return mapItem(rows[0] ?? null);
  });
}

export async function findTrackById(id) {
  if (!isValidUuid(id)) return null;
  return tracePhase('repo', 'findTrackById', async () => {
    const { rows } = await query(
      'findTrackById',
      'SELECT * FROM catalog.items WHERE id = $1 AND type = $2',
      [id, 'track']
    );
    return mapItem(rows[0] ?? null);
  });
}

export async function findItemById(id) {
  if (!isValidUuid(id)) return null;
  return tracePhase('repo', 'findItemById', async () => {
    const { rows } = await query(
      'findItemById',
      'SELECT * FROM catalog.items WHERE id = $1',
      [id]
    );
    return mapItem(rows[0] ?? null);
  });
}

export async function listArtists(args) {
  const { size, off } = normalizePage(args.page ?? {});
  const sort = normalizeSort(args.sort ?? null);
  const source = normalizeSource(args.source ?? null);
  const { where, params } = buildListQuery({
    type: 'artist',
    search: args.search ?? null,
    source,
  });

  params.push(size);
  params.push(off);

  const order = `${sort.column} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
  const sql = `SELECT * FROM catalog.items WHERE ${where.join(' AND ')}
                ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`;

  return tracePhase('repo', 'listArtists', async () => {
    const { rows } = await query('listArtists', sql, params);
    return rows.map(mapItem);
  });
}

export async function listTracks(args) {
  const { size, off } = normalizePage(args.page ?? {});
  const sort = normalizeSort(args.sort ?? null);
  const source = normalizeSource(args.source ?? null);
  const { where, params } = buildListQuery({
    type: 'track',
    search: args.search ?? null,
    source,
  });

  params.push(size);
  params.push(off);

  const order = `${sort.column} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
  const sql = `SELECT * FROM catalog.items WHERE ${where.join(' AND ')}
                ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`;

  return tracePhase('repo', 'listTracks', async () => {
    const { rows } = await query('listTracks', sql, params);
    return rows.map(mapItem);
  });
}

export async function listTracksByArtist(artistId) {
  if (!isValidUuid(artistId)) return [];
  return tracePhase('repo', 'listTracksByArtist', async () => {
    const { rows } = await query(
      'listTracksByArtist',
      `SELECT i.*
         FROM catalog.item_relations r
         JOIN catalog.items i ON i.id = r.child_id
        WHERE r.parent_id = $1 AND i.type = 'track'
        ORDER BY i.title ASC`,
      [artistId]
    );
    return rows.map(mapItem);
  });
}