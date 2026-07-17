import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Play, Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import WatchlistButton from './WatchlistButton';

function RecentCard({ item, serverId, onNavigate }) {
  const handleClick = () => {
    // Navigate straight to the live Emby item — no DB lookup needed.
    const params = new URLSearchParams({
      type: item.type || 'Movie',
      title: item.title || '',
      ...(item.posterUrl ? { poster: item.posterUrl } : {}),
      ...(serverId ? { server: serverId } : {}),
    });
    onNavigate(`/media/emby:${item.id}?${params.toString()}`);
  };

  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group" onClick={handleClick}>
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
        <WatchlistButton mediaId={`emby:${item.id}`} title={item.title} />
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
      {item.subtitle ? (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
      ) : item.year ? (
        <p className="text-[10px] text-muted-foreground mt-0.5">{item.year}</p>
      ) : null}
    </div>
  );
}

export default function EmbyRecentlyAdded({ serverId } = {}) {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['embyRecentlyAdded', serverId || 'default'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyRecentlyAdded', serverId ? { serverId } : {});
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const items = data?.items || [];

  if (error) {
    return (
      <div className="mb-2 px-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Couldn't connect to this Emby server. Check the connection in Settings.
        </p>
      </div>
    );
  }

  if (!isLoading && items.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="font-heading font-bold text-base text-foreground">Recently Added</h2>
        {data?.server?.server_name && (
          <span className="text-xs text-muted-foreground ml-1">from {data.server.server_name}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-3 px-4 sm:px-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
          {items.map(item => (
            <RecentCard key={item.id} item={item} serverId={serverId} onNavigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}