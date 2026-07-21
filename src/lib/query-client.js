import { QueryClient } from '@tanstack/react-query';
import { restoreQueryCache, saveQueryCache } from './queryPersister';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Automatically refetch when the browser reports the network is back
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        // Don't retry on offline — serve from cache instead
        if (!navigator.onLine) return false;
        // Retry queue: up to 4 attempts on a flaky relay before giving up
        return failureCount < 4;
      },
      // Exponential backoff with jitter — eases pressure on a recovering relay
      retryDelay: (attempt) =>
        Math.min(1000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 400),
      // Keep cache data for 24h so offline browsing works
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      // Return cached data even when a refetch fails
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry writes (sync/progress saves) a few times on transient failures
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      networkMode: 'offlineFirst',
    },
  },
});

// Restore persisted cache immediately on load
restoreQueryCache(queryClientInstance);

// Persist the cache on change — but DEBOUNCED. Serializing the whole query cache
// to localStorage runs JSON.stringify on the main thread; doing it on every cache
// event (dozens fire during load) pins the CPU and spikes memory hard enough to
// hang/crash the WebView. Coalesce bursts into one write every few seconds, and
// run it when the browser is idle so it never blocks the load.
let saveTimer = null;
const scheduleSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const run = () => saveQueryCache(queryClientInstance);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else run();
  }, 4000);
};

queryClientInstance.getQueryCache().subscribe(scheduleSave);