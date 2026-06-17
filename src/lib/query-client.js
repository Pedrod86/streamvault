import { QueryClient } from '@tanstack/react-query';
import { restoreQueryCache, saveQueryCache } from './queryPersister';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on offline — serve from cache instead
        if (!navigator.onLine) return false;
        return failureCount < 1;
      },
      // Keep cache data for 24h so offline browsing works
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      // Return cached data even when a refetch fails
      networkMode: 'offlineFirst',
    },
  },
});

// Restore persisted cache immediately on load
restoreQueryCache(queryClientInstance);

// Save cache to localStorage whenever it changes
queryClientInstance.getQueryCache().subscribe(() => {
  saveQueryCache(queryClientInstance);
});