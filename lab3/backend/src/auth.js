import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Генерация токена и запись сессии в БД
export async function generateToken(user, req = null) {
  const jti = crypto.randomUUID();

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      jti
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // Вычисляем дату истечения (1 час от текущего времени)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const userAgent = req ? req.headers['user-agent'] : 'Unknown';
  const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';

  try {
    // Отзываем ранее активные сессии только для данного пользователя с текущего устройства (совпадающие user_agent и ip_address)
    await pool.query(
      `UPDATE user_sessions
       SET is_revoked = TRUE
       WHERE user_id = $1
         AND user_agent = $2
         AND ip_address = $3
         AND is_revoked = FALSE`,
      [user.id, userAgent, String(ipAddress)]
    );

    // Создаем новую запись сессии для нового JWT
    await pool.query(
      `INSERT INTO user_sessions (user_id, jti, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, jti, userAgent, String(ipAddress), expiresAt]
    );
  } catch (err) {
    console.error('Failed to update/create session record:', err);
  }

  return token;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalid or expired' });
    }
    req.user = payload;
    next();
  });
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions for this operation'
      });
    }
    next();
  };
}