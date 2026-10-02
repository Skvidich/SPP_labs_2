import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from './api';

export function useApiData(endpoint, showMessage) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    // Если endpoint не задан (пользователь не авторизован), запрос не выполняем
    if (!endpoint) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest(endpoint);
      setData(result || []);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, showMessage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mutate = async (url, method, body, successMsg, callback) => {
    try {
      const res = await apiRequest(url, method, body);
      if (successMsg) showMessage(successMsg);
      if (callback) callback(res);
      await loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  return { data, loading, loadData, mutate };
}