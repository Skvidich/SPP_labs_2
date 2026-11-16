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
const SORT_COLUMNS = new Set(['title', 'created_at', 'createdAt', 'updated_at', 'updatedAt']);

const SORT_DIRECTIONS = new Set(['asc', 'desc']);

// Маппинг допустимых имён на реальные столбцы БД для безопасного ORDER BY.
const SORT_COLUMN_MAP = {
  title: 'title',
  created_at: 'created_at',
  createdAt: 'created_at',
  updated_at: 'updated_at',
  updatedAt: 'updated_at',
};

export class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserInputError';
    this.extensions = { code: 'BAD_USER_INPUT' };
  }
}

function normalizePage({ limit, offset }) {
  const size =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
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

function normalizeText(value, fieldName, optional = false) {
  if (value == null) {
    if (optional) return null;
    throw new UserInputError(`${fieldName} is required`);
  }
  const text = String(value).trim();
  if (text.length === 0) {
    throw new UserInputError(`${fieldName} must not be empty`);
  }
  return text;
}

function mapCollection(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRef(row) {
  if (!row) return null;
  return { id: row.item_id, __typename: 'Item' };
}

// Проверяет существование объекта каталога по ID через Catalog Service.
// Catalog хранит своих исполнителей и треки; Collections хранит только ID.
async function assertItemExists(itemId) {
  const endpoint = `${config.catalogUrl.replace(/\/$/, '')}/graphql`;
  const queryText = `
    query CheckItem($id: ID!) {
      artist(id: $id) { id }
      track(id: $id) { id }
    }
  `;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.catalogCheckTimeoutMs);
  let payload;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: queryText, variables: { id: itemId } }),
      signal: controller.signal,
    });
    const text = await res.text();
    payload = JSON.parse(text);
  } catch (err) {
    throw new UserInputError(
      `cannot verify item existence via Catalog Service: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  const data = payload?.data ?? {};
  const found = data.artist ?? data.track ?? null;
  if (!found) {
    throw new UserInputError(`item "${itemId}" does not exist in catalog`);
  }
  return found;
}

function collectionItemsSelect() {
  return `
    SELECT i.item_id
      FROM collections.collection_items i
     WHERE i.collection_id = $1
     ORDER BY i.created_at ASC
  `;
}

export async function listCollections(args) {
  const { size, off } = normalizePage(args.page ?? {});
  const sort = normalizeSort(args.sort ?? null);

  const where = [];
  const params = [];
  if (args.search && String(args.search).trim().length > 0) {
    params.push(`%${String(args.search).trim()}%`);
    where.push(`title ILIKE $${params.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const order = `${sort.column} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
  params.push(size);
  params.push(off);

  const sql = `SELECT * FROM collections.collections
                 ${whereSql}
                 ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`;

  return tracePhase('repo', 'listCollections', async () => {
    const { rows } = await query('listCollections', sql, params);
    return rows.map(mapCollection);
  });
}

export async function findCollectionById(id) {
  if (!isValidUuid(id)) return null;
  return tracePhase('repo', 'findCollectionById', async () => {
    const { rows } = await query(
      'findCollectionById',
      'SELECT * FROM collections.collections WHERE id = $1',
      [id]
    );
    return mapCollection(rows[0] ?? null);
  });
}

export async function listCollectionItems(collectionId) {
  if (!isValidUuid(collectionId)) return [];
  return tracePhase('repo', 'listCollectionItems', async () => {
    const { rows } = await query(
      'listCollectionItems',
      collectionItemsSelect(),
      [collectionId]
    );
    return rows.map(mapItemRef);
  });
}

export async function createCollection({ title, description }) {
  const safeTitle = normalizeText(title, 'title');
  const safeDescription = normalizeText(description, 'description', true);
  return tracePhase('repo', 'createCollection', async () => {
    const { rows } = await query(
      'createCollection',
      `INSERT INTO collections.collections (title, description)
       VALUES ($1, $2)
       RETURNING *`,
      [safeTitle, safeDescription]
    );
    return mapCollection(rows[0]);
  });
}

export async function updateCollection(id, { title, description }) {
  if (!isValidUuid(id)) {
    throw new UserInputError(`collection "${id}" is not a valid id`);
  }
  const current = await findCollectionById(id);
  if (!current) {
    throw new UserInputError(`collection "${id}" not found`);
  }

  const nextTitle = title === undefined ? current.title : normalizeText(title, 'title');
  const nextDescription =
    description === undefined ? current.description : normalizeText(description, 'description', true);

  return tracePhase('repo', 'updateCollection', async () => {
    const { rows } = await query(
      'updateCollection',
      `UPDATE collections.collections
          SET title = $1, description = $2, updated_at = now()
        WHERE id = $3
        RETURNING *`,
      [nextTitle, nextDescription, id]
    );
    return mapCollection(rows[0]);
  });
}

export async function deleteCollection(id) {
  if (!isValidUuid(id)) {
    throw new UserInputError(`collection "${id}" is not a valid id`);
  }
  return tracePhase('repo', 'deleteCollection', async () => {
    const { rowCount } = await query(
      'deleteCollection',
      'DELETE FROM collections.collections WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  });
}

export async function addItemToCollection(collectionId, itemId) {
  if (!isValidUuid(collectionId)) {
    throw new UserInputError(`collection "${collectionId}" is not a valid id`);
  }
  if (!isValidUuid(itemId)) {
    throw new UserInputError(`item "${itemId}" is not a valid id`);
  }
  return tracePhase('repo', 'addItemToCollection', async () => {
    const collectionExists = await findCollectionById(collectionId);
    if (!collectionExists) {
      throw new UserInputError(`collection "${collectionId}" not found`);
    }

    // Существование объекта проверяется через Catalog Service; в БД хранится
    // только ID без копирования атрибутов.
    await assertItemExists(itemId);

    let collection;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO collections.collection_items (collection_id, item_id)
         VALUES ($1, $2)
         ON CONFLICT (collection_id, item_id) DO NOTHING`,
        [collectionId, itemId]
      );

      await client.query(
        'UPDATE collections.collections SET updated_at = now() WHERE id = $1',
        [collectionId]
      );

      const { rows } = await client.query(
        'SELECT * FROM collections.collections WHERE id = $1',
        [collectionId]
      );
      collection = mapCollection(rows[0] ?? null);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (!collection) {
      throw new UserInputError(`collection "${collectionId}" not found`);
    }
    return collection;
  });
}

export async function removeItemFromCollection(collectionId, itemId) {
  if (!isValidUuid(collectionId)) {
    throw new UserInputError(`collection "${collectionId}" is not a valid id`);
  }
  if (!isValidUuid(itemId)) {
    throw new UserInputError(`item "${itemId}" is not a valid id`);
  }
  return tracePhase('repo', 'removeItemFromCollection', async () => {
    let collection;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM collections.collection_items WHERE collection_id = $1 AND item_id = $2',
        [collectionId, itemId]
      );

      await client.query(
        'UPDATE collections.collections SET updated_at = now() WHERE id = $1',
        [collectionId]
      );

      const { rows } = await client.query(
        'SELECT * FROM collections.collections WHERE id = $1',
        [collectionId]
      );
      collection = mapCollection(rows[0] ?? null);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (!collection) {
      throw new UserInputError(`collection "${collectionId}" not found`);
    }
    return collection;
  });
}