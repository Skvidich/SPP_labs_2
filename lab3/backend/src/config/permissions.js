export const permissionsMap = [
  // АУТЕНТИФИКАЦИЯ И ВОССТАНОВЛЕНИЕ (Публичные)
  { method: 'POST', path: '/api/auth/login', public: true },
  { method: 'POST', path: '/api/auth/register', public: true },
  { method: 'POST', path: '/api/auth/forgot-password', public: true },
  { method: 'POST', path: '/api/auth/reset-password', public: true },
  { method: 'GET', path: '/api/health', public: true },

  // СЕССИИ И АКТИВНЫЕ ПОДКЛЮЧЕНИЯ (Только ADMIN)
  { method: 'GET', path: '/api/auth/sessions', roles: ['admin'] },
  { method: 'DELETE', path: '/api/auth/sessions/:sessionId', roles: ['admin'] },
  { method: 'DELETE', path: '/api/auth/sessions/user/:userId', roles: ['admin'] },

  // СМОТРЕТЬ (user, editor, admin)
  { method: 'GET', path: '/api/movies', roles: ['user', 'editor', 'admin'] },
  { method: 'GET', path: '/api/movies/:id', roles: ['user', 'editor', 'admin'] },
  { method: 'GET', path: '/api/lists', roles: ['user', 'editor', 'admin'] },
  { method: 'GET', path: '/api/lists/:id', roles: ['user', 'editor', 'admin'] },
  { method: 'GET', path: '/api/lists/:id/movies', roles: ['user', 'editor', 'admin'] },

  // СОЗДАВАТЬ И ИЗМЕНЯТЬ (editor, admin)
  { method: 'POST', path: '/api/movies', roles: ['editor', 'admin'] },
  { method: 'PUT', path: '/api/movies/:id', roles: ['editor', 'admin'] },
  { method: 'POST', path: '/api/movies/:id/poster', roles: ['editor', 'admin'] },
  { method: 'POST', path: '/api/lists', roles: ['editor', 'admin'] },
  { method: 'PUT', path: '/api/lists/:id', roles: ['editor', 'admin'] },
  { method: 'POST', path: '/api/lists/:id/movies/:movieId', roles: ['editor', 'admin'] },
  { method: 'DELETE', path: '/api/lists/:id/movies/:movieId', roles: ['editor', 'admin'] },

  // УДАЛЯТЬ ОСНОВНЫЕ СУЩНОСТИ (только admin)
  { method: 'DELETE', path: '/api/movies/:id', roles: ['admin'] },
  { method: 'DELETE', path: '/api/lists/:id', roles: ['admin'] }
];