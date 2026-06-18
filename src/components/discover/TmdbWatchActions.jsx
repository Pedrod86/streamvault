import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BookmarkCheck, BookmarkPlus, CheckCircle2, Clock, Loader2 } from 'lucide-react';

export default function TmdbWatchActions({ item, details, type }) {
  const queryClient = useQueryClient();
  const [progressPercent, setProgressPercent] = useState([50]);
  const [showProgress, setShowProgress] = useState(false);

  const mediaType = type === 'tv' ? 'tv_show' : 'movie';
  const title = details?.title || item?.title;
  const totalSeconds = Math.max(60, (details?.runtime || item?.runtime || 60) * 60);

  const { data: localMedia = [] } = useQuery({
    queryKey: ['tmdbLocalMedia'],
    queryFn: () => base44.entities.Media.list('-created_date', 300),
    staleTime: 5 * 60 * 1000,
  });

  const localItem = localMedia.find(m =>
    m.media_type === mediaType &&
    m.title?.toLowerCase().trim() === title?.toLowerCase().trim()
  );

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date', 500),
    staleTime: 60 * 1000,
  });

  const isInWatchlist = localItem && watchlist.some(w => w.media_id === localItem.id);

  const ensureMedia = async () => {
    if (localItem) return localItem;

    return base44.entities.Media.create({
      title,
      media_type: mediaType,
      description: details?.overview || item?.overview || '',
      year: details?.year || item?.year || undefined,
      rating: details?.rating || item?.rating || undefined,
      duration_minutes: details?.runtime || undefined,
      poster_url: details?.poster || item?.poster || undefined,
      backdrop_url: details?.backdrop || item?.backdrop || undefined,
      genre: details?.genres || [],
      season_count: details?.season_count || undefined,
      tags: ['tmdb', `tmdb:${item?.tmdb_id}`],
    });
  };

  const upsertHistory = async ({ completed, percent }) => {
    const media = await ensureMedia();
    const existing = await base44.entities.WatchHistory.filter({ media_id: media.id });
    const progressSeconds = completed ? totalSeconds : Math.round(totalSeconds * (percent / 100));
    const data = {
      media_id: media.id,
      progress_seconds: progressSeconds,
      total_seconds: totalSeconds,
      completed,
      last_watched: new Date().toISOString(),
    };

    if (existing[0]) return base44.entities.WatchHistory.update(existing[0].id, data);
    return base44.entities.WatchHistory.create(data);
  };

  const addToWatchlist = useMutation({
    mutationFn: async () => {
      const media = await ensureMedia();
      const existing = await base44.entities.Watchlist.filter({ media_id: media.id });
      if (existing[0]) return existing[0];
      return base44.entities.Watchlist.create({ media_id: media.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmdbLocalMedia'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const markWatched = useMutation({
    mutationFn: () => upsertHistory({ completed: true, percent: 100 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmdbLocalMedia'] });
      queryClient.invalidateQueries({ queryKey: ['watchHistory'] });
    },
  });

  const saveProgress = useMutation({
    mutationFn: () => upsertHistory({ completed: false, percent: progressPercent[0] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmdbLocalMedia'] });
      queryClient.invalidateQueries({ queryKey: ['watchHistory'] });
      setShowProgress(false);
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="border-border gap-2"
          onClick={() => addToWatchlist.mutate()}
          disabled={addToWatchlist.isPending || isInWatchlist}
        >
          {addToWatchlist.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isInWatchlist ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <BookmarkPlus className="w-4 h-4" />}
          {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
        </Button>
        <Button
          variant="outline"
          className="border-border gap-2"
          onClick={() => markWatched.mutate()}
          disabled={markWatched.isPending}
        >
          {markWatched.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Mark as Watched
        </Button>
        <Button
          variant="outline"
          className="border-border gap-2"
          onClick={() => setShowProgress(v => !v)}
        >
          <Clock className="w-4 h-4" /> Update Progress
        </Button>
      </div>

      {showProgress && (
        <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent[0]}%</span>
          </div>
          <Slider value={progressPercent} min={1} max={99} step={1} onValueChange={setProgressPercent} />
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => saveProgress.mutate()}
            disabled={saveProgress.isPending}
          >
            {saveProgress.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Progress
          </Button>
        </div>
      )}
    </div>
  );
}