import express from 'express';
import pool from '../db.js';

const router = express.Router();

function validateList(data) {
  const { name, description } = data;

  if (typeof name !== 'string' || name.trim() === '') {
    return 'Name is required';
  }

  if (name.trim().length > 200) {
    return 'Name must be 200 characters or less';
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    return 'Description must be a string';
  }

  if (
    typeof description === 'string' &&
    description.length > 2000
  ) {
    return 'Description must be 2000 characters or less';
  }

  return null;
}

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

// GET /api/lists
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        created_at
      FROM lists
      ORDER BY id
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/lists/:id
router.get('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          created_at
        FROM lists
        WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/lists
router.post('/', async (req, res, next) => {
  const validationError = validateList(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const name = req.body.name.trim();
  const description =
    typeof req.body.description === 'string'
      ? req.body.description.trim()
      : null;

  try {
    const result = await pool.query(
      `
        INSERT INTO lists (name, description)
        VALUES ($1, $2)
        RETURNING
          id,
          name,
          description,
          created_at
      `,
      [name, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/lists/:id
router.put('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  const validationError = validateList(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const name = req.body.name.trim();
  const description =
    typeof req.body.description === 'string'
      ? req.body.description.trim()
      : null;

  try {
    const result = await pool.query(
      `
        UPDATE lists
        SET
          name = $1,
          description = $2
        WHERE id = $3
        RETURNING
          id,
          name,
          description,
          created_at
      `,
      [name, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/lists/:id
router.delete('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  try {
    const result = await pool.query(
      'DELETE FROM lists WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;