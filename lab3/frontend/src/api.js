const API_URL = '/api';

export async function apiRequest(url, method = 'GET', body = null) {
  const options = { method, headers: {} };

  const token = localStorage.getItem('token');
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_URL}${url}`, options);

  if (res.status === 401) {
    // Если токен истек, очищаем данные авторизации
    if (localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Ошибка HTTP ${res.status}`);
  }

  return res.status === 204 ? null : res.json().catch(() => null);
}