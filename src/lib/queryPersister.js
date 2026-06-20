/**
 * Simple localStorage persister for TanStack Query cache.
 * Saves/restores the full query cache so the app works offline
 * and loads instantly from cache on next visit.
 */

const CACHE_KEY = 'streamvault_query_cache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function saveQueryCache(queryClient) {
  try {
    const cache = queryClient.getQueryCache().getAll().map(query => ({
      queryKey: query.queryKey,
      state: query.state,
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      cache,
    }));
  } catch (e) {
    // localStorage full or unavailable — ignore
  }
}

export function restoreQueryCache(queryClient) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const { timestamp, cache } = JSON.parse(raw);
    if (Date.now() - timestamp > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    cache.forEach(({ queryKey, state }) => {
      if (state?.data !== undefined) {
        // Restore for instant display, but mark as stale (updatedAt: 0) so
        // React Query refetches fresh data in the background on launch.
        // This keeps offline/instant loads while ensuring media stays current.
        queryClient.setQueryData(queryKey, state.data, { updatedAt: 0 });
      }
    });
  } catch (e) {
    // Corrupt cache — ignore
  }
}