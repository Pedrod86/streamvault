import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Search, Play, Star, Clock, X, ChevronLeft, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';
import { Skeleton } from '@/components/ui/skeleton';

// ── helpers ────────────────────────────────────────────────────────────────
function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&maxWidth=400`;
}

function buildStreamUrl(base, itemId, token) {
  return `${base}/Videos/${itemId}/stream?api_key=${token}&Static=true`;
}

// Try direct browser fetch first (works for local/LAN servers).
// Falls back to mediaProxy only if CORS blocks the direct request.
async function directFetch(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function proxyFetch(url, headers = {}) {
  const res = await base44.functions.invoke('mediaProxy', { url, headers });
  if (res.data?.error) throw new Error(res.data.error);
  if (!res.data.ok) throw new Error(`HTTP ${res.data.status}`);
  return res.data.data;
}

async function embyFetch(url, headers = {}) {
  try {
    return await directFetch(url, headers);
  } catch (err) {
    // CORS or network error — fall back to server-side proxy
    if (err.name === 'TypeError' || err.message?.includes('fetch') || err.name === 'AbortError') {
      return proxyFetch(url, headers);
    }
    throw err;
  }
}

// ── sub-components ─────────────────────────────────────────────────────────
function MediaCard({ item, onPlay }) {
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
        {item.type === 'Series' && (
          <div className="absolute top-2 right-2">
            <Badge className="text-[9px] px-1 py-0 bg-accent text-accent-foreground">TV</Badge>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
      {item.year && <p className="text-[10px] text-muted-foreground mt-0.5">{item.year}</p>}
    </div>
  );
}

function MediaRow({ title, items, onPlay }) {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <h2 className="font-heading font-bold text-base text-foreground px-4 sm:px-6 mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => (
          <MediaCard key={item.id} item={item} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

function DetailOverlay({ item, onClose, onPlay }) {
  const backdropUrl = item.backdropUrl || item.posterUrl;
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden">
        {/* Backdrop */}
        <div className="relative h-48 sm:h-56">
          {backdropUrl ? (
            <img src={backdropUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-6 -mt-8 relative">
          <div className="flex items-start gap-3 mb-3">
            {item.posterUrl && (
              <img src={item.posterUrl} alt={item.title} className="w-16 rounded-lg shadow-lg shrink-0 aspect-[2/3] object-cover" />
            )}
            <div className="pt-8">
              <h2 className="font-heading font-bold text-lg text-foreground leading-tight">{item.title}</h2>
              <div className="flex flex-wrap gap-2 mt-1 items-center text-xs text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.rating && (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    {item.rating.toFixed(1)}
                  </span>
                )}
                {item.duration && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {Math.floor(item.duration / 60)}h {item.duration % 60}m
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {item.type === 'Series' ? 'TV Show' : 'Movie'}
                </Badge>
              </div>
            </div>
          </div>

          {item.genres?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {item.genres.map(g => (
                <Badge key={g} variant="outline" className="text-[10px] px-1.5 border-border/50 text-muted-foreground">{g}</Badge>
              ))}
            </div>
          )}

          {item.overview && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-3">{item.overview}</p>
          )}

          <Button
            className="w-full bg-primary hover:bg-primary/90 gap-2 rounded-xl"
            onClick={() => onPlay(item)}
          >
            <Play className="w-4 h-4 fill-current" />
            {item.type === 'Series' ? 'Play (Direct Stream)' : 'Play Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function EmbyLibrary() {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [playingItem, setPlayingItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  // Get Emby servers
  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });

  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);

  // Fetch library directly from Emby
  const { data: library = [], isLoading, error } = useQuery({
    queryKey: ['embyLiveLibrary', embyServer?.id],
    enabled: !!embyServer,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const base = embyServer.server_url.replace(/\/$/, '');
      const token = embyServer.api_token;
      const authHeaders = { 'X-Emby-Token': token };

      // Get user ID
      let userId;
      try {
        const me = await embyFetch(`${base}/Users/Me`, authHeaders);
        userId = me?.Id;
      } catch (_) {}
      if (!userId) {
        const users = await embyFetch(`${base}/Users`, authHeaders);
        const list = Array.isArray(users) ? users : (users?.Items || []);
        const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
        userId = admin?.Id;
      }
      if (!userId) throw new Error('Could not authenticate with Emby');

      // Fetch all items (paginated)
      const PAGE = 500;
      let startIndex = 0;
      const all = [];

      while (true) {
        const json = await embyFetch(
          `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
          `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
          `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}`,
          authHeaders
        );
        const items = json.Items || [];
        for (const item of items) {
          all.push({
            id: item.Id,
            title: item.Name,
            type: item.Type,
            year: item.ProductionYear,
            rating: item.CommunityRating ? parseFloat(item.CommunityRating.toFixed(1)) : null,
            duration: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
            overview: item.Overview || '',
            genres: item.Genres || [],
            posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
            backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
            streamUrl: buildStreamUrl(base, item.Id, token),
          });
        }
        if (items.length < PAGE) break;
        startIndex += PAGE;
      }

      return all;
    },
  });

  const filters = ['All', 'Movies', 'TV Shows'];

  const filtered = useMemo(() => {
    let items = library;
    if (activeFilter === 'Movies') items = items.filter(i => i.type === 'Movie');
    if (activeFilter === 'TV Shows') items = items.filter(i => i.type === 'Series');
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [library, activeFilter, search]);

  // Group by genre for browsing (only when not searching)
  const sections = useMemo(() => {
    if (search.trim()) return null; // flat search results

    const movies = filtered.filter(i => i.type === 'Movie');
    const shows = filtered.filter(i => i.type === 'Series');

    const genreMap = {};
    filtered.forEach(item => {
      item.genres.forEach(g => {
        if (!genreMap[g]) genreMap[g] = [];
        genreMap[g].push(item);
      });
    });
    const topGenres = Object.entries(genreMap)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);

    const rows = [];
    if (activeFilter !== 'TV Shows' && movies.length) rows.push({ title: 'Movies', items: movies });
    if (activeFilter !== 'Movies' && shows.length) rows.push({ title: 'TV Shows', items: shows });
    topGenres.forEach(([g, items]) => rows.push({ title: g, items }));
    return rows;
  }, [filtered, activeFilter, search]);

  const handlePlay = (item) => {
    setSelectedItem(null);
    setPlayingItem(item);
  };

  const handleCardClick = (item) => {
    setSelectedItem(item);
  };

  // ── render ─────────────────────────────────────────────────────────────
  if (!embyServer) {
    return (
      <div className="pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Database className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-heading font-bold text-xl text-foreground">No Emby Server</h2>
        <p className="text-sm text-muted-foreground max-w-xs">Connect an Emby server in Settings to browse your library.</p>
      </div>
    );
  }

  return (
    <div className="pt-16 pb-24">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground">
              {embyServer.server_name || 'Emby Library'}
            </h1>
            {library.length > 0 && (
              <p className="text-xs text-muted-foreground">{library.length.toLocaleString()} items</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your library…"
            className="pl-9 bg-secondary border-border rounded-xl"
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-8 px-4 sm:px-6">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <Skeleton className="h-5 w-32 mb-3 bg-secondary" />
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map(j => (
                  <Skeleton key={j} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 px-6">
          <p className="text-destructive text-sm font-medium mb-1">Failed to load library</p>
          <p className="text-muted-foreground text-xs">{error.message}</p>
        </div>
      ) : search.trim() ? (
        // Flat search results
        <div>
          <p className="text-xs text-muted-foreground px-4 sm:px-6 mb-3">{filtered.length} results for "{search}"</p>
          <div className="flex flex-wrap gap-3 px-4 sm:px-6">
            {filtered.map(item => (
              <MediaCard key={item.id} item={item} onPlay={handleCardClick} />
            ))}
          </div>
        </div>
      ) : (
        // Rows
        <div>
          {sections?.map(({ title, items }) => (
            <MediaRow key={title} title={title} items={items} onPlay={handleCardClick} />
          ))}
        </div>
      )}

      {/* Detail overlay */}
      {selectedItem && (
        <DetailOverlay
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onPlay={handlePlay}
        />
      )}

      {/* Emby Video player */}
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