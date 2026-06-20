import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearConnectionRoutes } from '@/lib/embyConnection';

// Belt-and-braces auto-refetch on reconnect. React Query's refetchOnReconnect
// relies on its own onlineManager; in an Android WebView the browser 'online'
// event can be unreliable, so we also explicitly refetch stale queries when the
// network returns or the app regains focus after being backgrounded.
export function useReconnectRefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refetchStale = () => {
      if (!navigator.onLine) return;
      // Re-probe LAN-first vs relay since the network may have changed
      clearConnectionRoutes();
      // Only refetch queries that are actually being observed on screen
      queryClient.refetchQueries({ type: 'active', stale: true });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchStale();
    };

    window.addEventListener('online', refetchStale);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', refetchStale);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queryClient]);
}