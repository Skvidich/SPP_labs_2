import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db.js';

const router = express.Router();

const uploadsDirectory = path.resolve('uploads');

fs.mkdirSync(uploadsDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }

    cb(null, true);
  }
});

function validateMovie(data) {
  const { title, director, year } = data;

  if (typeof title !== 'string' || title.trim() === '') {
    return 'Title is required';
  }

  if (title.trim().length > 200) {
    return 'Title must be 200 characters or less';
  }

  if (typeof director !== 'string' || director.trim() === '') {
    return 'Director is required';
  }

  if (director.trim().length > 200) {
    return 'Director must be 200 characters or less';
  }

  if (!Number.isInteger(year)) {
    return 'Year must be an integer';
  }

  if (year < 1888 || year > new Date().getFullYear()) {
    return `Year must be between 1888 and ${new Date().getFullYear()}`;
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

// GET /api/movies
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        director,
        year,
        poster_name,
        poster_path,
        created_at
      FROM movies
      ORDER BY id
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/movies/:id
router.get('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          title,
          director,
          year,
          poster_name,
          poster_path,
          created_at
        FROM movies
        WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Movie not found'
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/movies
router.post('/', async (req, res, next) => {
  const validationError = validateMovie(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const title = req.body.title.trim();
  const director = req.body.director.trim();
  const year = req.body.year;

  try {
    const result = await pool.query(
      `
        INSERT INTO movies (title, director, year)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          title,
          director,
          year,
          poster_name,
          poster_path,
          created_at
      `,
      [title, director, year]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/movies/:id
router.put('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  const validationError = validateMovie(req.body);

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  const title = req.body.title.trim();
  const director = req.body.director.trim();
  const year = req.body.year;

  try {
    const result = await pool.query(
      `
        UPDATE movies
        SET
          title = $1,
          director = $2,
          year = $3
        WHERE id = $4
        RETURNING
          id,
          title,
          director,
          year,
          poster_name,
          poster_path,
          created_at
      `,
      [title, director, year, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Movie not found'
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/movies/:id
router.delete('/:id', async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  try {
    const result = await pool.query(
      'DELETE FROM movies WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Movie not found'
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/movies/:id/poster
router.post('/:id/poster', upload.single('poster'), async (req, res, next) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({
      error: 'Invalid movie ID'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: 'Poster file is required'
    });
  }

  try {
    const movieResult = await pool.query(
      'SELECT id FROM movies WHERE id = $1',
      [id]
    );

    if (movieResult.rows.length === 0) {
      fs.unlinkSync(req.file.path);

      return res.status(404).json({
        error: 'Movie not found'
      });
    }

    const posterPath = `/uploads/${req.file.filename}`;

    const result = await pool.query(
      `
        UPDATE movies
        SET
          poster_name = $1,
          poster_path = $2
        WHERE id = $3
        RETURNING
          id,
          title,
          director,
          year,
          poster_name,
          poster_path,
          created_at
      `,
      [req.file.originalname, posterPath, id]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // File cleanup failure is not the main request error.
      }
    }

    next(error);
  }
});

export default router;