import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { permissionsMap } from '../config/permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

function matchPath(routePath, reqPath) {
  const pattern = routePath.replace(/:[a-zA-Z0-9_]+/g, '[^/]+');
  const regex = new RegExp(`^${pattern}/?$`);
  return regex.test(reqPath);
}

export async function authorizeGuard(req, res, next) {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const rule = permissionsMap.find(
    (item) => item.method === req.method && matchPath(item.path, req.path)
  );

  if (rule && rule.public) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);

    // Проверка активности сессии в БД
    if (user.jti) {
      const sessionRes = await pool.query(
        'SELECT is_revoked FROM user_sessions WHERE jti = $1',
        [user.jti]
      );

      if (sessionRes.rows.length === 0 || sessionRes.rows[0].is_revoked) {
        return res.status(401).json({ error: 'Session has been revoked or expired' });
      }
    }

    req.user = user;

    if (rule && rule.roles && !rule.roles.includes(user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions for this operation'
      });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalid or expired' });
  }
}