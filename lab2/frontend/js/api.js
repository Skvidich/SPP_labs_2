const API_URL = '/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getDefaultErrorMessage(status) {
  switch (status) {
    case 400:
      return 'Некорректные данные.';
    case 404:
      return 'Ресурс не найден.';
    case 409:
      return 'Конфликт данных.';
    case 500:
      return 'Внутренняя ошибка сервера.';
    default:
      return `Ошибка HTTP ${status}.`;
  }
}

export async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${url}`, options);
  } catch {
    throw new ApiError(
      0,
      'Не удалось подключиться к серверу.'
    );
  }

  if (!response.ok) {
    let errorMessage = getDefaultErrorMessage(response.status);

    try {
      const data = await response.json();

      if (typeof data?.error === 'string') {
        errorMessage = data.error;
      }
    } catch {
      // Сервер мог вернуть не JSON.
    }

    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      response.status,
      'Сервер вернул некорректный JSON.'
    );
  }
}