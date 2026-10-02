import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function parseUserAgent(ua) {
  if (!ua) return 'Неизвестно';
  if (ua.includes('Postman')) return '🚀 Postman';
  if (ua.includes('Chrome')) return '🌐 Chrome';
  if (ua.includes('Firefox')) return '🦊 Firefox';
  if (ua.includes('Safari')) return '🧭 Safari';
  if (ua.includes('Edge')) return '🌊 Edge';
  return '🖥️ Браузер';
}

export function SessionsModal({ onClose, showMessage }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/auth/sessions');
      setSessions(data || []);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId) => {
    try {
      await apiRequest(`/auth/sessions/${sessionId}`, 'DELETE');
      showMessage('Сессия успешно отозвана');
      loadSessions();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleRevokeUser = async (userId, username) => {
    if (!confirm(`Завершить все сессии пользователя ${username}?`)) return;
    try {
      await apiRequest(`/auth/sessions/user/${userId}`, 'DELETE');
      showMessage(`Все сессии пользователя ${username} завершены`);
      loadSessions();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10, 12, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          color: 'var(--text-main)',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '1000px',
          width: '92%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-main)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
            🔒 Активные сессии
          </h3>
          <button type="button" className="secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {loading ? (
          <div className="empty">Загрузка активных сессий...</div>
        ) : sessions.length === 0 ? (
          <div className="empty">Активных сессий не найдено.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 10px' }}>Пользователь</th>
                  <th style={{ padding: '12px 10px' }}>Роль</th>
                  <th style={{ padding: '12px 10px' }}>Устройство / IP</th>
                  <th style={{ padding: '12px 10px' }}>Создана</th>
                  <th style={{ padding: '12px 10px' }}>Истекает</th>
                  <th style={{ padding: '12px 10px' }}>Статус</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600, color: '#fff' }}>
                      {s.username}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className="role-tag">{s.role}</span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ color: '#fff' }}>{parseUserAgent(s.user_agent)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{s.ip_address}</div>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(s.created_at)}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(s.expires_at)}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      {s.is_revoked ? (
                        <span style={{ color: 'var(--danger-red)', fontSize: '12px' }}>● Отозвана</span>
                      ) : (
                        <span style={{ color: 'var(--accent-green)', fontSize: '12px' }}>● Активна</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {!s.is_revoked && (
                          <button type="button" className="danger" onClick={() => handleRevoke(s.id)}>
                            Отозвать
                          </button>
                        )}
                        <button type="button" className="secondary" onClick={() => handleRevokeUser(s.user_id, s.username)}>
                          Сбросить все
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}