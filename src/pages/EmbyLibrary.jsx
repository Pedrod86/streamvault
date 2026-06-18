import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Search, Play, Star, X, RefreshCw, Loader2, Clapperboard, MonitorPlay } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ExoPlayer from '@/components/media/ExoPlayer';
import EmbySeriesBrowser from '@/components/media/EmbySeriesBrowser';
import { Skeleton } from '@/components/ui/skeleton';
import { scanState, resetScan, runScan } from '@/lib/embyScanState';

const IS_4K = (item) =>
  !!item && (
    item.is4k === true ||
    item.tags?.some(t => /^4k$/i.test(t) || /4k|2160p|uhd/i.test(t)) ||
    !!(item.title?.match(/\b(4K|UHD|2160p)\b/i))
  );

// Normalise items from either scan state or DB so filtering always works
const normalise = (item) => ({
  ...item,
  media_type: item.media_type || (item.type === 'Series' ? 'tv_show' : 'movie'),
  poster_url: item.poster_url || item.posterUrl,
  genre: item.genre || item.genres || [],
});

function MediaCard({ item, onPlay }) {
  const poster = item.poster_url || item.posterUrl;
  const year = item.year || item.ProductionYear;
  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group" onClick={() => onPlay(item)}>
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2">
        {poster ? (
          <img src={poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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
            <span className="text-white text-[10px] font-medium">{Number(item.rating).toFixed(1)}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {(item.media_type === 'tv_show' || item.type === 'Series') && (
            <Badge className="text-[9px] px-1 py-0 bg-accent text-accent-foreground">TV</Badge>
          )}
          {IS_4K(item) && (
            <Badge className="text-[9px] px-1 py-0 bg-yellow-500/90 text-black font-bold">4K</Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
      {year && <p className="text-[10px] text-muted-foreground mt-0.5">{year}</p>}
    </div>
  );
}

function MediaRow({ title, items, onPlay, badge }) {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
        <h2 className="font-heading font-bold text-base text-foreground">{title}</h2>
        {badge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{badge}</span>
        )}
        <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => <MediaCard key={item.id} item={item} onPlay={onPlay} />)}
      </div>
    </div>
  );
}

export default function EmbyLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [playingItem, setPlayingItem] = useState(null);
  const [browsingItem, setBrowsingItem] = useState(null);

  const [activeFilter, setActiveFilter] = useState('All');
  const [scanProgress, setScanProgress] = useState({ loading: scanState.loading, done: scanState.done, total: scanState.total, count: scanState.library.length });

  // Build a title→embyId lookup from the in-memory scan state
  const embyIdByTitle = useMemo(() => {
    const map = new Map();
    scanState.library.forEach(i => {
      if (i.title) map.set(i.title.toLowerCase().trim(), i.id);
    });
    return map;
  }, [scanProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = (item) => {
    if (item.media_type === 'tv_show') {
      // Look up the real Emby ID from in-memory scan state by title
      const embyId = embyIdByTitle.get(item.title?.toLowerCase().trim());
      setBrowsingItem({ ...item, embyId });
    } else {
      setPlayingItem(item);
    }
  };

  // Subscribe to scan state for progress indicator only
  useEffect(() => {
    const listener = (state) => {
      setScanProgress({ loading: state.loading, done: state.done, total: state.total, count: state.library.length });
      // Refresh DB query when a new page of items has been saved
      if (!state.loading) queryClient.invalidateQueries({ queryKey: ['embyMedia'] });
    };
    scanState.listeners.add(listener);
    // Kick off scan if not already running/done
    if (!scanState.loading && !scanState.done) runScan();
    return () => scanState.listeners.delete(listener);
  }, [queryClient]);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });
  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);

  // Primary source: in-memory scan state (populated from localStorage cache immediately,
  // then filled live from the scan). Falls back to DB query only when scan state is empty.
  const [liveLibrary, setLiveLibrary] = useState(scanState.library);

  useEffect(() => {
    // Also sync liveLibrary whenever scanProgress changes (scan brought in more items)
    setLiveLibrary([...scanState.library]);
  }, [scanProgress]);

  const { data: dbLibrary = [], isLoading } = useQuery({
    queryKey: ['embyMedia'],
    queryFn: () => base44.entities.Media.filter({ tags: 'emby' }, 'title', 5000),
    staleTime: 2 * 60 * 1000,
    // Only hit the DB if scan state has nothing
    enabled: liveLibrary.length === 0 && !scanProgress.loading,
  });

  // Prefer live scan data; fall back to DB records
  const library = liveLibrary.length > 0 ? liveLibrary : dbLibrary;

  const filters = [
    { id: 'All', label: 'All' },
    { id: 'Movies', label: 'Movies' },
    { id: 'TV Shows', label: 'TV Shows' },
    { id: '4K Movies', label: '4K Movies', icon: Clapperboard },
    { id: '4K TV', label: '4K TV', icon: MonitorPlay },
  ];

  const filtered = useMemo(() => {
    let items = library.map(normalise);
    if (activeFilter === 'Movies') items = items.filter(i => i.media_type === 'movie' && !IS_4K(i));
    if (activeFilter === 'TV Shows') items = items.filter(i => i.media_type === 'tv_show' && !IS_4K(i));
    if (activeFilter === '4K Movies') items = items.filter(i => i.media_type === 'movie' && IS_4K(i));
    if (activeFilter === '4K TV') items = items.filter(i => i.media_type === 'tv_show' && IS_4K(i));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [library, activeFilter, search]);

  const sections = useMemo(() => {
    if (search.trim()) return null;
    const is4kFilter = activeFilter === '4K Movies' || activeFilter === '4K TV';

    if (activeFilter === '4K Movies') {
      return [{ title: '4K Movies', items: filtered }];
    }
    if (activeFilter === '4K TV') {
      return [{ title: '4K TV Shows', items: filtered }];
    }

    const movies = filtered.filter(i => i.media_type === 'movie' && !IS_4K(i));
    const shows = filtered.filter(i => i.media_type === 'tv_show' && !IS_4K(i));
    const movies4k = filtered.filter(i => i.media_type === 'movie' && IS_4K(i));
    const shows4k = filtered.filter(i => i.media_type === 'tv_show' && IS_4K(i));
    const genreMap = {};
    filtered.filter(i => !IS_4K(i)).forEach(item => {
      (item.genre || []).forEach(g => {
        if (!genreMap[g]) genreMap[g] = [];
        genreMap[g].push(item);
      });
    });
    const topGenres = Object.entries(genreMap).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
    const rows = [];
    if (activeFilter !== 'TV Shows' && movies.length) rows.push({ title: 'Movies', items: movies });
    if (activeFilter !== 'Movies' && shows.length) rows.push({ title: 'TV Shows', items: shows });
    if (activeFilter !== 'TV Shows' && movies4k.length) rows.push({ title: '4K Movies', items: movies4k, badge: '4K' });
    if (activeFilter !== 'Movies' && shows4k.length) rows.push({ title: '4K TV Shows', items: shows4k, badge: '4K' });
    topGenres.forEach(([g, gItems]) => rows.push({ title: g, items: gItems }));
    return rows;
  }, [filtered, activeFilter, search]);

  const handleRescan = () => {
    resetScan();
    setTimeout(() => runScan(), 100);
  };

  if (isLoading && library.length === 0) {
    return (
      <div className="pt-20 pb-24">
        <div className="px-4 sm:px-6 pt-4 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground">Emby Library</h1>
            <p className="text-xs text-muted-foreground">Loading your library…</p>
          </div>
        </div>
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
      </div>
    );
  }

  return (
    <div className="pt-16 pb-24">
      <div className="px-4 sm:px-6 pt-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-lg text-foreground">
              {embyServer?.server_name || 'Emby Library'}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {library.length.toLocaleString()} items
                {scanProgress.total > 0 && !scanProgress.done && ` · scanning ${scanProgress.count} / ${scanProgress.total}`}
              </p>
              {scanProgress.loading && (
                <span className="flex items-center gap-1 text-[10px] text-accent">
                  <Loader2 className="w-3 h-3 animate-spin" /> syncing…
                </span>
              )}
              {scanProgress.done && (
                <span className="text-[10px] text-green-400">✓ up to date</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRescan} className="gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

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

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {filters.map(f => {
            const Icon = f.icon;
            const is4k = f.id === '4K Movies' || f.id === '4K TV';
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === f.id
                    ? is4k ? 'bg-yellow-500 text-black' : 'bg-primary text-primary-foreground'
                    : is4k ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {library.length === 0 && !isLoading && scanProgress.loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-6">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <h2 className="font-heading font-bold text-xl text-foreground">Scanning your library…</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {scanProgress.count > 0 ? `${scanProgress.count} items loaded so far` : 'Connecting to Emby…'}
          </p>
        </div>
      ) : library.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Database className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="font-heading font-bold text-xl text-foreground">No Emby content yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Connect your Emby server and tap "Start Scan" to import your library.
          </p>
          <Button variant="outline" onClick={handleRescan} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Start Scan
          </Button>
        </div>
      ) : search.trim() ? (
        <div>
          <p className="text-xs text-muted-foreground px-4 sm:px-6 mb-3">{filtered.length} results for "{search}"</p>
          <div className="flex flex-wrap gap-3 px-4 sm:px-6">
            {filtered.map(item => <MediaCard key={item.id} item={item} onPlay={handlePlay} />)}
          </div>
        </div>
      ) : (
        <div>
          {sections?.map(({ title, items, badge }) => (
            <MediaRow key={title} title={title} items={items} onPlay={handlePlay} badge={badge} />
          ))}
        </div>
      )}

      {playingItem && embyServer && (() => {
        const tagEmbyId = (playingItem.tags || []).find(t => t?.startsWith('emby:') && t !== 'emby')?.replace('emby:', '');
        const urlMatch = (playingItem.video_url || '').match(/\/Videos\/([^/]+)\//);
        const embyId = playingItem.emby_id || tagEmbyId || (urlMatch ? urlMatch[1] : null) || playingItem.id;
        const base = embyServer.server_url?.replace(/\/$/, '');
        const token = embyServer.api_token;
        const src = `${base}/Videos/${embyId}/stream?api_key=${token}&Static=true&MediaSourceId=${embyId}`;
        return (
          <ExoPlayer
            src={src}
            title={playingItem.title}
            onClose={() => setPlayingItem(null)}
          />
        );
      })()}

      {browsingItem && embyServer && (
        <EmbySeriesBrowser
          item={browsingItem}
          server={embyServer}
          onClose={() => setBrowsingItem(null)}
        />
      )}
    </div>
  );
}