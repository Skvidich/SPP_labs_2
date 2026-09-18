import express from 'express';
import pool from '../db.js';

const router = express.Router();

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

// GET /api/lists/:listId/movies
router.get('/:listId/movies', async (req, res, next) => {
  const listId = parseId(req.params.listId);

  if (listId === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  try {
    const listResult = await pool.query(
      'SELECT id FROM lists WHERE id = $1',
      [listId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    const result = await pool.query(
      `
        SELECT
          m.id,
          m.title,
          m.director,
          m.year,
          m.poster_name,
          m.poster_path,
          m.created_at
        FROM movies m
        INNER JOIN list_movies lm
          ON lm.movie_id = m.id
        WHERE lm.list_id = $1
        ORDER BY m.id
      `,
      [listId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/lists/:listId/movies/:movieId
router.post('/:listId/movies/:movieId', async (req, res, next) => {
  const listId = parseId(req.params.listId);
  const movieId = parseId(req.params.movieId);

  if (listId === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  if (movieId === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  try {
    const listResult = await pool.query(
      'SELECT id FROM lists WHERE id = $1',
      [listId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({
        error: 'List not found'
      });
    }

    const movieResult = await pool.query(
      'SELECT id FROM movies WHERE id = $1',
      [movieId]
    );

    if (movieResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Movie not found'
      });
    }

    const relationResult = await pool.query(
      `
        SELECT list_id, movie_id
        FROM list_movies
        WHERE list_id = $1 AND movie_id = $2
      `,
      [listId, movieId]
    );

    if (relationResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Movie is already in this list'
      });
    }

    await pool.query(
      `
        INSERT INTO list_movies (list_id, movie_id)
        VALUES ($1, $2)
      `,
      [listId, movieId]
    );

    res.status(201).json({
      list_id: listId,
      movie_id: movieId
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/lists/:listId/movies/:movieId
router.delete('/:listId/movies/:movieId', async (req, res, next) => {
  const listId = parseId(req.params.listId);
  const movieId = parseId(req.params.movieId);

  if (listId === null) {
    return res.status(400).json({
      error: 'Invalid list ID'
    });
  }

  if (movieId === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  try {
    const result = await pool.query(
      `
        DELETE FROM list_movies
        WHERE list_id = $1 AND movie_id = $2
        RETURNING list_id, movie_id
      `,
      [listId, movieId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Movie is not in this list'
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;