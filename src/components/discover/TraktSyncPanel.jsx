import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trakt } from '@/lib/metadataService';
import { Loader2, RefreshCw, TrendingUp, Star, BookMarked, History, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-secondary rounded-xl p-3 flex flex-col gap-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-lg font-bold text-foreground font-heading">{value ?? '—'}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function HistoryItem({ item }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
        <History className="w-4 h-4 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.year}</p>
      </div>
      {item.rating && (
        <div className="flex items-center gap-1 text-amber-400 text-xs shrink-0">
          <Star className="w-3 h-3 fill-amber-400" /> {item.rating}
        </div>
      )}
    </div>
  );
}

export default function TraktSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['trakt_stats'],
    queryFn: () => trakt.stats(),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const { data: history, isLoading: histLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['trakt_history'],
    queryFn: () => trakt.syncHistory(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      await refetchHistory();
      const total = (history?.history_movies?.length || 0) + (history?.history_shows?.length || 0);
      setSyncResult({ success: true, message: `Synced ${total} items from Trakt` });
    } catch (err) {
      setSyncResult({ success: false, message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  if (statsError || (stats?.error)) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Trakt not connected or token invalid. Go to Connections to reconnect.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Trakt stats…
        </div>
      ) : stats && !stats.error ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Movies watched" value={stats.movies?.watched} icon={TrendingUp} color="bg-blue-500" />
          <StatCard label="Shows watched" value={stats.shows?.watched} icon={BarChart2} color="bg-purple-500" />
          <StatCard label="Episodes" value={stats.episodes?.watched} icon={History} color="bg-green-500" />
          <StatCard label="Ratings given" value={stats.ratings?.total} icon={Star} color="bg-amber-500" />
        </div>
      ) : null}

      {/* Sync button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Now
        </Button>
        {syncResult && (
          <div className={`flex items-center gap-1.5 text-sm ${syncResult.success ? 'text-green-400' : 'text-destructive'}`}>
            {syncResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Recent history */}
      {!histLoading && history && !history.error && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Recent History
          </h3>
          <div className="bg-secondary rounded-xl px-3 py-1 max-h-48 overflow-y-auto">
            {[...(history.history_movies || []), ...(history.history_shows || [])]
              .slice(0, 15)
              .map((item, i) => <HistoryItem key={i} item={item} />)}
          </div>
        </div>
      )}

      {/* Watchlist */}
      {!histLoading && history?.watchlist?.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5" /> Trakt Watchlist ({history.watchlist.length})
          </h3>
          <div className="bg-secondary rounded-xl px-3 py-1 max-h-40 overflow-y-auto">
            {history.watchlist.slice(0, 10).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <p className="text-sm text-foreground flex-1 truncate">{item.title}</p>
                <span className="text-xs text-muted-foreground shrink-0 capitalize">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}