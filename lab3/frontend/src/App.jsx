import React, { useState, useCallback, useEffect } from 'react';
import { useApiData } from './useApiData';
import { Notification } from './components/Notification';
import { EntitySection } from './components/EntitySection';
import { AuthForm } from './components/AuthForm';
import { SessionsModal } from './components/SessionsModal';

export function App() {
  const [notif, setNotif] = useState({ message: '', type: 'success' });
  const [showSessions, setShowSessions] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      setResetToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const showMessage = useCallback((message, type = 'success') => setNotif({ message, type }), []);
  const clearMessage = useCallback(() => setNotif({ message: '', type: 'success' }), []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setResetToken('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setResetToken('');
    clearMessage();
  };

  const moviesApi = useApiData(user ? '/movies' : null, showMessage);
  const listsApi = useApiData(user ? '/lists' : null, showMessage);

  const toObj = (fd) => Object.fromEntries(fd.entries());

  const canEdit = Boolean(user && (user.role === 'editor' || user.role === 'admin'));
  const isAdmin = Boolean(user && user.role === 'admin');

  return (
    <>
      <header className="header">
        <div className="container header-content">
          <div className="brand-logo">
            🎬 Movie<span>Box</span>
          </div>
          {user && (
            <div className="user-info">
              <span className="user-badge">
                <strong>{user.username}</strong>
                <span className="role-tag">{user.role}</span>
              </span>
              {isAdmin && (
                <button type="button" className="secondary" onClick={() => setShowSessions(true)}>
                  🔒 Сессии
                </button>
              )}
              <button type="button" className="secondary" onClick={handleLogout}>Выйти</button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        <Notification message={notif.message} type={notif.type} onClose={clearMessage} />

        {showSessions && isAdmin && (
          <SessionsModal onClose={() => setShowSessions(false)} showMessage={showMessage} />
        )}

        {!user ? (
          <AuthForm
            onLogin={handleLogin}
            showMessage={showMessage}
            initialResetToken={resetToken}
            onResetComplete={() => setResetToken('')}
          />
        ) : (
          <>
            <EntitySection
              title="Фильмы"
              description="Каталог фильмов и управление постерами"
              items={moviesApi.data}
              loading={moviesApi.loading}
              canEdit={canEdit}
              canDelete={isAdmin}
              renderFormFields={(item = {}) => (
                <>
                  <label>Название <input name="title" defaultValue={item.title} maxLength={200} required /></label>
                  <label>Режиссёр <input name="director" defaultValue={item.director} maxLength={200} required /></label>
                  <label>Год выпуска <input name="year" type="number" defaultValue={item.year || new Date().getFullYear()} min={1888} max={new Date().getFullYear()} required /></label>
                </>
              )}
              onCreate={(fd, cb) => moviesApi.mutate('/movies', 'POST', { ...toObj(fd), year: Number(fd.get('year')) }, 'Фильм создан', cb)}
              onSaveEdit={(id, fd, cb) => moviesApi.mutate(`/movies/${id}`, 'PUT', { ...toObj(fd), year: Number(fd.get('year')) }, 'Фильм изменён', cb)}
              onDelete={(id) => confirm('Удалить фильм?') && moviesApi.mutate(`/movies/${id}`, 'DELETE', null, 'Фильм удалён', listsApi.loadData)}
              onUploadPoster={(id, file) => {
                const fd = new FormData();
                fd.append('poster', file);
                moviesApi.mutate(`/movies/${id}/poster`, 'POST', fd, 'Постер обновлен');
              }}
            />

            <EntitySection
              title="Коллекции"
              description="Пользовательские подборки и списки"
              items={listsApi.data}
              loading={listsApi.loading}
              allMovies={moviesApi.data}
              canEdit={canEdit}
              canDelete={isAdmin}
              renderFormFields={(item = {}) => (
                <>
                  <label>Название коллекции <input name="name" defaultValue={item.name} maxLength={200} required /></label>
                  <label>Описание <textarea name="description" defaultValue={item.description} maxLength={2000} rows={3} /></label>
                </>
              )}
              onCreate={(fd, cb) => listsApi.mutate('/lists', 'POST', toObj(fd), 'Список создан', cb)}
              onSaveEdit={(id, fd, cb) => listsApi.mutate(`/lists/${id}`, 'PUT', toObj(fd), 'Список изменён', cb)}
              onDelete={(id) => confirm('Удалить список?') && listsApi.mutate(`/lists/${id}`, 'DELETE', null, 'Список удалён')}
              onAddMovie={(listId, movieId) => listsApi.mutate(`/lists/${listId}/movies/${movieId}`, 'POST', null, 'Фильм добавлен в коллекцию')}
              onRemoveMovie={(listId, movieId) => listsApi.mutate(`/lists/${listId}/movies/${movieId}`, 'DELETE', null, 'Фильм убран из коллекции')}
            />
          </>
        )}
      </main>
    </>
  );
}