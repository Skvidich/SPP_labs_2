import rateLimit from 'express-rate-limit';

// Ограничение попыток входа в систему (защита от Brute-Force)
export const loginRateLimiter = rateLimit({
  windowMs:  60 * 1000, // Окно 15 минут
  max: 5, // Максимум 5 попыток с одного IP за указанное окно
  standardHeaders: true, // Возвращать заголовки RateLimit-* в соответствии с RFC 7231 / draft-ietf-wg-httpapi-ratelimit-headers
  legacyHeaders: false, // Отключить заголовки X-RateLimit-*
  statusCode: 429, // Стандартный HTTP код
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.'
  },
  handler: (req, res, next, options) => {
    req.log.warn(
      { ip: req.ip, url: req.url },
      `Rate limit exceeded for login attempts from IP: ${req.ip}`
    );
    res.status(options.statusCode).json(options.message);
  }
});

// Общее ограничение частых запросов к публичным эндпоинтам авторизации
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 20, // Максимум 20 запросов в минуту
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests to auth endpoints. Please slow down.'
  }
});