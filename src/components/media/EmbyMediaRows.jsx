import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';
import EmbySeriesBrowser from '@/components/media/EmbySeriesBrowser';

function EmbyCard({ item, onPlay }) {
  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group" onClick={() => onPlay(item)}>
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
        </div>
        {item.rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white text-[10px] font-medium">{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
      {item.year && <p className="text-[10px] text-muted-foreground mt-0.5">{item.year}</p>}
    </div>
  );
}

function EmbyRow({ title, items, onPlay }) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="font-heading font-bold text-base text-foreground">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => (
          <EmbyCard key={item.id} item={item} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

export default function EmbyMediaRows() {
  const [playingItem, setPlayingItem] = useState(null);
  const [browsingItem, setBrowsingItem] = useState(null);

  const handlePlay = (item) => {
    // Extract real Emby ID from streamUrl (works for both movies and series)
    const streamUrl = item.streamUrl || item.video_url || '';
    const match = streamUrl.match(/\/Videos\/([^/]+)\/stream/);
    const embyId = match ? match[1] : item.id;

    if (item.type === 'Series') {
      setBrowsingItem({ ...item, embyId, media_type: 'tv_show', poster_url: item.posterUrl });
    } else {
      setPlayingItem({ ...item, id: embyId });
    }
  };

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);

  const { data: library = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 2000),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <Skeleton className="h-5 w-28 mb-3 mx-4 sm:mx-6 bg-secondary" />
            <div className="flex gap-3 px-4 sm:px-6">
              {[1,2,3,4,5].map(j => (
                <Skeleton key={j} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!library.length) return null;

  // Map Media entity shape to what EmbyCard expects
  const mapped = library.map(m => ({
    id: m.id,
    title: m.title,
    type: m.media_type === 'tv_show' ? 'Series' : 'Movie',
    year: m.year,
    rating: m.rating,
    overview: m.description,
    genres: m.genre || [],
    posterUrl: m.poster_url,
    backdropUrl: m.backdrop_url,
    streamUrl: m.video_url,
  }));

  const movies = mapped.filter(i => i.type === 'Movie');
  const shows = mapped.filter(i => i.type === 'Series');

  const genreMap = {};
  mapped.forEach(item => {
    item.genres?.forEach(g => {
      if (!genreMap[g]) genreMap[g] = [];
      genreMap[g].push(item);
    });
  });
  const genreRows = Object.entries(genreMap)
    .sort((a, b) => b[1].length - a[1].length)
    .filter(([, items]) => items.length >= 3)
    .slice(0, 6);

  return (
    <>
      <EmbyRow title="Emby Movies" items={movies} onPlay={handlePlay} />
      <EmbyRow title="Emby TV Shows" items={shows} onPlay={handlePlay} />
      {genreRows.map(([genre, items]) => (
        <EmbyRow key={genre} title={genre} items={items} onPlay={handlePlay} />
      ))}

      {playingItem && embyServer && (
        <EmbyVideoPlayer
          item={playingItem}
          server={embyServer}
          onClose={() => setPlayingItem(null)}
        />
      )}

      {browsingItem && embyServer && (
        <EmbySeriesBrowser
          item={browsingItem}
          server={embyServer}
          onClose={() => setBrowsingItem(null)}
        />
      )}
    </>
  );
}