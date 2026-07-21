/**
 * Simple localStorage persister for TanStack Query cache.
 * Saves/restores the full query cache so the app works offline
 * and loads instantly from cache on next visit.
 */

const CACHE_KEY = 'streamvault_query_cache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Queries that must NEVER be persisted/restored from localStorage.
// These are cheap, authoritative database reads. Persisting them means a stale
// or transiently-empty snapshot can be restored on launch — which is exactly
// what made connected servers "disappear" until a full refetch succeeded.
// Always let these load fresh from the database instead.
const NEVER_PERSIST = ['mediaServers'];

const isPersistable = (queryKey) => {
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return !NEVER_PERSIST.includes(root);
};

// Hard ceiling on the serialized cache. A runaway cache serialized to a
// multi-megabyte string on the main thread can hang/crash a mobile WebView, so
// if we exceed this we simply skip the write rather than risk the device.
const MAX_CACHE_BYTES = 3 * 1024 * 1024; // 3 MB

export function saveQueryCache(queryClient) {
  try {
    const cache = queryClient.getQueryCache().getAll()
      .filter(query => isPersistable(query.queryKey))
      .map(query => ({
        queryKey: query.queryKey,
        state: query.state,
      }));
    const payload = JSON.stringify({
      timestamp: Date.now(),
      cache,
    });
    if (payload.length > MAX_CACHE_BYTES) return; // too big — skip this write
    localStorage.setItem(CACHE_KEY, payload);
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
      if (!isPersistable(queryKey)) return;
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