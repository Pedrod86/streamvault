import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Trash2, History, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function ProgressBar({ value }) {
  return (
    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-2">
      <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.round(value))}%` }}
      />
    </div>
  );
}

export default function WatchHistory() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
  });

  // Fetch only the media records referenced by the history entries (handles
  // large libraries where a bulk list would miss older items)
  const { data: allMedia = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['watchHistoryMedia', history.map(h => h.media_id).sort().join(',')],
    enabled: history.length > 0,
    queryFn: async () => {
      const ids = [...new Set(history.map(h => h.media_id).filter(Boolean))];
      const results = await Promise.all(
        ids.map(id => base44.entities.Media.filter({ id }).then(r => r[0]).catch(() => null))
      );
      return results.filter(Boolean);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id) => base44.entities.WatchHistory.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchHistory'] }),
  });

  const isLoading = histLoading || mediaLoading;

  const mediaMap = new Map(allMedia.map(m => [m.id, m]));

  const entries = history
    .map(h => ({ ...h, media: mediaMap.get(h.media_id) }))
    .filter(h => h.media);

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <History className="w-6 h-6 text-primary" />
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Watch History</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-secondary" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No watch history yet</p>
          <p className="text-muted-foreground text-sm mt-1">Start watching something and your progress will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const pct = entry.total_seconds > 0
              ? (entry.progress_seconds / entry.total_seconds) * 100
              : 0;
            const remaining = entry.total_seconds > 0
              ? Math.max(0, entry.total_seconds - entry.progress_seconds)
              : null;

            return (
              <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-border/80 transition-colors group">
                {/* Poster */}
                <Link to={`/media/${entry.media_id}`} className="shrink-0">
                  <div className="w-14 h-20 rounded-lg overflow-hidden bg-secondary">
                    {entry.media.poster_url ? (
                      <img src={entry.media.poster_url} alt={entry.media.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">?</div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link to={`/media/${entry.media_id}`} className="hover:text-primary transition-colors">
                    <p className="font-heading font-semibold text-foreground truncate">{entry.media.title}</p>
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {entry.completed ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Watched
                      </span>
                    ) : remaining != null ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {Math.ceil(remaining / 60)} min left
                      </span>
                    ) : null}
                    {entry.last_watched && (
                      <span className="text-muted-foreground/60">
                        · {formatDistanceToNow(new Date(entry.last_watched), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {!entry.completed && entry.total_seconds > 0 && (
                    <ProgressBar value={pct} />
                  )}
                </div>

                {/* Resume */}
                {!entry.completed && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => navigate(`/media/${entry.media_id}`)}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Resume
                  </Button>
                )}

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => deleteEntry.mutate(entry.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}