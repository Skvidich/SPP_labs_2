import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';

export function AuthForm({ onLogin, showMessage, initialResetToken = '', onResetComplete }) {
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setMode('reset');
    } else {
      setResetToken('');
      setMode('login');
    }
  }, [initialResetToken]);

  const switchMode = (newMode) => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('user');
    setMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await apiRequest('/auth/login', 'POST', { username, password });
        onLogin(data.user, data.token);
        showMessage('Успешный вход в систему');
      } else if (mode === 'register') {
        const data = await apiRequest('/auth/register', 'POST', { username, email, password, role });
        onLogin(data.user, data.token);
        showMessage('Регистрация прошла успешно');
      } else if (mode === 'forgot') {
        const data = await apiRequest('/auth/forgot-password', 'POST', { email });
        showMessage(data.message);
        switchMode('login');
      } else if (mode === 'reset') {
        const data = await apiRequest('/auth/reset-password', 'POST', { token: resetToken, newPassword: password });
        showMessage(data.message);
        setResetToken('');
        if (onResetComplete) onResetComplete();
        switchMode('login');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '60px auto' }} className="section">
      <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#fff' }}>
        {mode === 'login' && 'Вход в систему'}
        {mode === 'register' && 'Регистрация'}
        {mode === 'forgot' && 'Восстановление доступа'}
        {mode === 'reset' && 'Установка нового пароля'}
      </h2>

      <form className="form" style={{ background: 'transparent', border: 'none', padding: 0 }} onSubmit={handleSubmit}>
        {(mode === 'login' || mode === 'register') && (
          <label>
            Логин
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
        )}

        {(mode === 'register' || mode === 'forgot') && (
          <label>
            Электронная почта
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}

        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
          <label>
            {mode === 'reset' ? 'Новый пароль (мин. 6 символов)' : 'Пароль'}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
              required
            />
          </label>
        )}

        {mode === 'register' && (
          <label>
            Роль
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User (Только просмотр)</option>
              <option value="editor">Editor (Просмотр и редактирование)</option>
              <option value="admin">Admin (Полный доступ)</option>
            </select>
          </label>
        )}

        <button type="submit" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
          {loading ? 'Обработка...' : (
            mode === 'login' ? 'Войти' :
            mode === 'register' ? 'Зарегистрироваться' :
            mode === 'forgot' ? 'Отправить ссылку' : 'Сохранить новый пароль'
          )}
        </button>
      </form>

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        {mode === 'login' && (
          <>
            <button type="button" className="secondary" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => switchMode('register')}>
              Нет аккаунта? Зарегистрироваться
            </button>
            <button type="button" className="secondary" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => switchMode('forgot')}>
              Забыли пароль?
            </button>
          </>
        )}
        {(mode === 'register' || mode === 'forgot' || mode === 'reset') && (
          <button type="button" className="secondary" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => switchMode('login')}>
            Вернуться к форме входа
          </button>
        )}
      </div>
    </div>
  );
}