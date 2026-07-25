
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * @param {(token: string) => Promise<any>} fetcher
 * @param {any[]} deps - extra dependencies that should trigger a refetch
 */
export function useApiData(fetcher, deps = [], intervalMs = null) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(token);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps]);

useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  // auto-refresh
  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return { data, loading, error, refetch, setData };
}
