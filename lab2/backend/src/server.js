import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from './db.js';
import moviesRouter from './routes/movies.js';
import listsRouter from './routes/lists.js';
import listMoviesRouter from './routes/listMovies.js';

const app = express();

const PORT = Number(process.env.PORT || 3000);

const frontendDirectory = path.resolve('../frontend');

app.use(express.json());

app.use('/uploads', express.static('uploads'));

app.get('/api/health', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT 1 AS database_ok');

    res.status(200).json({
      status: 'ok',
      database: result.rows[0].database_ok === 1
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/movies', moviesRouter);
app.use('/api/lists', listsRouter);
app.use('/api/lists', listMoviesRouter);

app.use(express.static(frontendDirectory));

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File is too large. Maximum size is 5 MB'
      });
    }

    return res.status(400).json({
      error: error.message
    });
  }

  if (error.message === 'Only JPEG, PNG and WebP images are allowed') {
    return res.status(400).json({
      error: error.message
    });
  }

  res.status(500).json({
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});