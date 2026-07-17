import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import WatchlistButton from './WatchlistButton';

function PlexCard({ item, onPlay }) {
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
        <div className="absolute top-2 right-2">
          <Badge className="text-[9px] px-1 py-0 bg-accent/90 text-accent-foreground">
            {item.type === 'Series' ? 'TV' : 'Movie'}
          </Badge>
        </div>
        <WatchlistButton mediaId={`plex:${item.id}`} title={item.title} />
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
      {item.year && <p className="text-[10px] text-muted-foreground mt-0.5">{item.year}</p>}
    </div>
  );
}

function PlexRow({ title, items, onPlay }) {
  if (!items?.length) return null;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="font-heading font-bold text-base text-foreground">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => (
          <PlexCard key={item.id} item={item} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

export default function PlexLibraryViews() {
  const navigate = useNavigate();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['plexViews'],
    queryFn: () => base44.functions.invoke('plexViews', {}).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
  });

  const handlePlay = (item) => {
    if (!item?.id) return;
    const params = new URLSearchParams();
    if (item.type) params.set('type', item.type);
    if (item.title) params.set('title', item.title);
    if (item.posterUrl) params.set('poster', item.posterUrl);
    if (item.year) params.set('year', String(item.year));
    if (item.overview) params.set('overview', item.overview);
    navigate(`/media/plex:${item.id}?${params.toString()}`);
  };

  const views = data?.views;

  // Show skeletons while loading OR while a background refetch is replacing a
  // stale/empty persisted cache (so restored empty data doesn't hide the rows).
  if (isLoading || (isFetching && !views?.length)) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i}>
            <Skeleton className="h-5 w-28 mb-3 mx-4 sm:mx-6 bg-secondary" />
            <div className="flex gap-3 px-4 sm:px-6">
              {[1, 2, 3, 4, 5].map(j => (
                <Skeleton key={j} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!views?.length) {
    return (
      <p className="px-4 sm:px-6 text-sm text-muted-foreground">
        Couldn't load Plex libraries. Try reconnecting your Plex server in Connect Server.
      </p>
    );
  }

  return (
    <>
      {views.map(view => (
        <PlexRow key={view.id} title={view.name} items={view.items} onPlay={handlePlay} />
      ))}
    </>
  );
}