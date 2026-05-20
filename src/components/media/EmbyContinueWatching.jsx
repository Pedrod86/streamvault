import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';

function ContinueCard({ item, server, onPlay }) {
  return (
    <div
      className="shrink-0 w-[160px] sm:w-[180px] cursor-pointer group"
      onClick={() => onPlay(item)}
    >
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-video mb-2">
        {item.backdropUrl || item.posterUrl ? (
          <img
            src={item.backdropUrl || item.posterUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
        </div>
        {/* Progress bar */}
        {item.progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(item.progressPercent, 100)}%` }}
            />
          </div>
        )}
        {/* Time remaining */}
        {item.progressPercent > 0 && item.duration > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Clock className="w-2.5 h-2.5 text-white/70" />
            <span className="text-white text-[10px]">
              {Math.round(item.duration * (1 - item.progressPercent / 100))}m left
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">
        {item.seriesName || item.title}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
        {item.seasonEpisode
          ? `${item.seasonEpisode} · ${item.episodeName || ''}`
          : item.year || ''}
      </p>
    </div>
  );
}

export default function EmbyContinueWatching() {
  const [playingItem, setPlayingItem] = useState(null);
  const [playingServer, setPlayingServer] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['embyContinueWatching'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyContinueWatching', {});
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const items = data?.items || [];
  const server = data?.server;

  if (isLoading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-5 w-40 mb-3 mx-4 sm:mx-6 bg-secondary" />
        <div className="flex gap-3 px-4 sm:px-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="shrink-0 w-[160px] h-[90px] rounded-xl bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <>
      <div className="mb-6">
        <h2 className="font-heading font-bold text-base text-foreground px-4 sm:px-6 mb-3">
          Continue Watching
        </h2>
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
          {items.map(item => (
            <ContinueCard
              key={item.id}
              item={item}
              server={server}
              onPlay={(i) => { setPlayingItem(i); setPlayingServer(server); }}
            />
          ))}
        </div>
      </div>

      {playingItem && playingServer && (
        <EmbyVideoPlayer
          item={playingItem}
          server={playingServer}
          onClose={() => { setPlayingItem(null); setPlayingServer(null); }}
        />
      )}
    </>
  );
}