import express from 'express';
import multer from 'multer';
import path from 'path';
import pinoHttp from 'pino-http';
import pool from './db.js';
import { logger } from './logger.js';
import { authorizeGuard } from './middleware/authorize.js';
import authRouter from './routes/auth.js';
import moviesRouter from './routes/movies.js';
import listsRouter from './routes/lists.js';
import listMoviesRouter from './routes/listMovies.js';
import 'dotenv/config';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const frontendDirectory = path.resolve('../frontend');

// Логирование HTTP-запросов и ответов
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health'
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) => {
      return `[RESPONSE] ${req.method} ${req.url} -> Status: ${res.statusCode} (${responseTime}ms)`;
    },
    customErrorMessage: (req, res, error) => {
      return `[ERROR] ${req.method} ${req.url} -> Status: ${res.statusCode} - ${error.message}`;
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type']
        }
      }),
      res: (res) => ({
        statusCode: res.statusCode
      }),
      err: (err) => ({
        type: err.type,
        message: err.message,
        stack: err.stack
      })
    }
  })
);

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Публичный health-check эндпоинт
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

// Маршруты авторизации (регистрация/логин)
app.use('/api/auth', authRouter);

// Прослойка проверки ролей и прав доступа (RBAC) на основе временных JWT-токенов
app.use(authorizeGuard);

// Основные API маршруты (не требуют изменений внутренних роутеров)
app.use('/api/movies', moviesRouter);
app.use('/api/lists', listsRouter);
app.use('/api/lists', listMoviesRouter);

// Раздача статики фронтенда
app.use(express.static(frontendDirectory));

// Централизованная обработка ошибок с логированием и корректными HTTP статусами
app.use((error, req, res, next) => {
  req.log.error(
    {
      err: error,
      method: req.method,
      url: req.url,
      body: req.body
    },
    `Unhandled Error: ${error.message}`
  );

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 5 MB' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error.message === 'Only JPEG, PNG and WebP images are allowed') {
    return res.status(400).json({ error: error.message });
  }

  // Ошибки PostgreSQL
  if (error.code === '22P02') {
    return res.status(400).json({ error: 'Invalid data format or type' });
  }
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (error.code === '23503') {
    return res.status(404).json({ error: 'Referenced resource not found' });
  }

  res.status(500).json({
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT}`);
});