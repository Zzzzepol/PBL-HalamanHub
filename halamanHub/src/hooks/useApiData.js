// ============================================================
// HalamanHub — useApiData hook
// Fetches data from the backend using the current auth token,
// with loading/error state and a refetch helper.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * @param {(token: string) => Promise<any>} fetcher
 * @param {any[]} deps - extra dependencies that should trigger a refetch
 */
export function useApiData(fetcher, deps = []) {
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

  return { data, loading, error, refetch, setData };
}
