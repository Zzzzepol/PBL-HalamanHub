import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Module-level cache. This object lives outside any component, so it is
// NOT reset when a page component unmounts (e.g. React Router swapping the
// <Outlet/> content when you navigate away from /sensors and back). It's
// only cleared on a full browser reload. This is what lets a page render
// its previous data instantly instead of flashing back to empty/loading.
const cache = new Map();

/**
 * @param {(token: string) => Promise<any>} fetcher
 * @param {any[]} deps - extra dependencies that should trigger a refetch
 * @param {number|null} intervalMs - polling interval
 * @param {string|null} cacheKey - unique key to cache/restore data under.
 *   Pass one whenever the component using this hook can be unmounted and
 *   remounted (e.g. any admin page reached via the sidebar) so switching
 *   back to it is instant instead of re-showing a loading state.
 */
export function useApiData(fetcher, deps = [], intervalMs = null, cacheKey = null) {
  const { token } = useAuth();
  const hasCached = cacheKey !== null && cache.has(cacheKey);

  const [data, setData] = useState(hasCached ? cache.get(cacheKey) : null);
  // If we already have cached data for this key, skip the loading state on
  // mount — render the cached data immediately and refresh quietly instead.
  const [loading, setLoading] = useState(!hasCached);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ background = false } = {}) => {
    if (!token) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const result = await fetcher(token);
      setData(result);
      if (cacheKey !== null) cache.set(cacheKey, result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cacheKey, ...deps]);

  useEffect(() => {
    // On mount: if we already have cached data, this is just a "coming
    // back to this tab" refresh — do it silently in the background so the
    // cached data stays on screen the whole time. Only show the loading
    // state on a genuinely first-ever fetch.
    refetch({ background: cacheKey !== null && cache.has(cacheKey) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  // auto-refresh
  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refetch({ background: true });
    }, intervalMs);
    return () => clearInterval(id);
  }, [refetch, intervalMs]);

  return { data, loading, error, refetch, setData };
}