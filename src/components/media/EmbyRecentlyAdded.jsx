import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';

function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&maxWidth=400`;
}

async function fetchRecentlyAdded(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const headers = { 'X-Emby-Token': token };

  // Resolve userId
  let userId;
  try {
    const me = await fetch(`${base}/Users/Me`, { headers, signal: AbortSignal.timeout(10000) });
    if (me.ok) userId = (await me.json())?.Id;
  } catch (_) {}
  if (!userId) {
    const res = await fetch(`${base}/Users`, { headers, signal: AbortSignal.timeout(10000) });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : (list?.Items || []);
    userId = (arr.find(u => u.Policy?.IsAdministrator) || arr[0])?.Id;
  }
  if (!userId) throw new Error('Could not authenticate with Emby');

  const res = await fetch(
    `${base}/Users/${userId}/Items/Latest?IncludeItemTypes=Movie,Episode&Fields=Overview,Genres,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,SeriesName,ParentId&Limit=20`,
    { headers, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`Emby returned HTTP ${res.status}`);
  const items = await res.json();

  return (Array.isArray(items) ? items : []).map(item => ({
    id: item.Id,
    title: item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name,
    subtitle: item.Type === 'Episode' ? `S${String(item.ParentIndexNumber).padStart(2,'0')}E${String(item.IndexNumber).padStart(2,'0')} – ${item.Name}` : null,
    type: item.Type,
    year: item.ProductionYear,
    rating: item.CommunityRating ? parseFloat(item.CommunityRating.toFixed(1)) : null,
    overview: item.Overview || '',
    genres: item.Genres || [],
    posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
    backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
    streamUrl: `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true`,
  }));
}

function RecentCard({ item, onPlay }) {
  return (
    <div
      className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group"
      onClick={() => onPlay(item)}
    >
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
            {item.type === 'Episode' ? 'EP' : 'Movie'}
          </Badge>
        </div>
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

export default function EmbyRecentlyAdded() {
  const [playingItem, setPlayingItem] = useState(null);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });

  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['embyRecentlyAdded', embyServer?.id],
    enabled: !!embyServer,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchRecentlyAdded(embyServer),
  });

  if (!embyServer || error || (!isLoading && items.length === 0)) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="font-heading font-bold text-base text-foreground">Recently Added</h2>
        <span className="text-xs text-muted-foreground ml-1">from {embyServer.server_name || 'Emby'}</span>
      </div>

      {isLoading ? (
        <div className="flex gap-3 px-4 sm:px-6">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
          ))}
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map(item => (
            <RecentCard key={item.id} item={item} onPlay={setPlayingItem} />
          ))}
        </div>
      )}

      {playingItem && (
        <EmbyVideoPlayer
          item={playingItem}
          server={embyServer}
          onClose={() => setPlayingItem(null)}
        />
      )}
    </div>
  );
}