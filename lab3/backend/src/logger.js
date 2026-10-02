import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,               // Подсвечивать методы и статусы цветом
      translateTime: 'yyyy-mm-dd HH:MM:ss.l', // Читаемый формат времени
      ignore: 'pid,hostname',        // Убираем лишние системные поля
      singleLine: false,             // Подробный многострочный вывод при ошибках
      messageFormat: '{req.method} {req.url} {res.statusCode} - {msg} ({responseTime}ms)'
    }
  }
});