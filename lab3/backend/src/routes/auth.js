import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { generateToken } from '../auth.js';
import { loginRateLimiter, authRateLimiter } from '../middleware/rateLimiter.js';
import { sendResetPasswordEmail } from '../utils/mailer.js';

const router = express.Router();

const ALLOWED_ROLES = new Set(['user', 'editor', 'admin']);

router.use(authRateLimiter);

// POST /api/auth/register
// Email обязателен при регистрации (для сброса пароля), но не используется для входа
router.post('/register', async (req, res, next) => {
  const { username, email, password, role } = req.body;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!email || typeof email !== 'string' || email.trim() === '') {
    return res.status(400).json({ error: 'Email is required for password recovery' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password is required and must be at least 6 characters long' });
  }

  const targetRole = role ? String(role).toLowerCase().trim() : 'user';

  if (!ALLOWED_ROLES.has(targetRole)) {
    return res.status(400).json({ error: 'Invalid role. Allowed roles: user, editor, admin' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, created_at`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, targetRole]
    );

    const user = result.rows[0];
    const token = await generateToken(user, req);

    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === '23505') {
      if (error.detail && error.detail.includes('email')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(409).json({ error: 'Username already exists' });
    }
    next(error);
  }
});

// POST /api/auth/login
// Идентификация и вход выполняются ИСКЛЮЧИТЕЛЬНО по username
router.post('/login', loginRateLimiter, async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Поиск пользователя строго по username
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = await generateToken(user, req);

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
// Email используется исключительно для получения ссылки восстановления доступа
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || email.trim() === '') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const userRes = await pool.query(
      'SELECT id, email FROM users WHERE LOWER(email) = $1',
      [email.trim().toLowerCase()]
    );

    // Защита от перебора: всегда одинаковое сообщение
    if (userRes.rows.length === 0) {
      return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    }

    const user = userRes.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    await sendResetPasswordEmail(user.email, resetToken);

    res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Token and new password (min 6 chars) are required' });
  }

  try {
    const tokenRes = await pool.query(
      `SELECT * FROM password_resets 
       WHERE token = $1 AND is_used = FALSE AND expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetRecord = tokenRes.rows[0];
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, resetRecord.user_id]);
    await pool.query('UPDATE password_resets SET is_used = TRUE WHERE id = $1', [resetRecord.id]);
    await pool.query('UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1', [resetRecord.user_id]);

    res.status(200).json({ message: 'Password has been successfully reset. Please log in with your new password.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/sessions (Только Admin)
router.get('/sessions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
        s.id,
        s.user_id,
        u.username,
        u.role,
        s.ip_address,
        s.user_agent,
        s.is_revoked,
        s.created_at,
        s.expires_at
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.expires_at > CURRENT_TIMESTAMP
       ORDER BY s.created_at DESC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions/:sessionId (Только Admin)
router.delete('/sessions/:sessionId', async (req, res, next) => {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  try {
    const result = await pool.query(
      'UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1 RETURNING id',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions/user/:userId (Только Admin)
router.delete('/sessions/user/:userId', async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    await pool.query(
      'UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1',
      [userId]
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;