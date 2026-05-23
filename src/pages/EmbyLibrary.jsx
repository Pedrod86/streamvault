import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Database, Search, Play, Star, X, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';
import EmbySeriesBrowser from '@/components/media/EmbySeriesBrowser';
import { Skeleton } from '@/components/ui/skeleton';
import { scanState, resetScan, runScan } from '@/lib/embyScanState';

function MediaCard({ item, onPlay }) {
  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group" onClick={() => onPlay(item)}>
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2">
        {item.poster_url ? (
          <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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
        {item.media_type === 'tv_show' && (
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

  const { data: library = [], isLoading } = useQuery({
    queryKey: ['embyMedia'],
    queryFn: () => base44.entities.Media.filter({ tags: 'emby' }, 'title', 5000),
    staleTime: 2 * 60 * 1000,
  });

  const filters = ['All', 'Movies', 'TV Shows'];

  const filtered = useMemo(() => {
    let items = library;
    if (activeFilter === 'Movies') items = items.filter(i => i.media_type === 'movie');
    if (activeFilter === 'TV Shows') items = items.filter(i => i.media_type === 'tv_show');
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return items;
  }, [library, activeFilter, search]);

  const sections = useMemo(() => {
    if (search.trim()) return null;
    const movies = filtered.filter(i => i.media_type === 'movie');
    const shows = filtered.filter(i => i.media_type === 'tv_show');
    const genreMap = {};
    filtered.forEach(item => {
      item.genre?.forEach(g => {
        if (!genreMap[g]) genreMap[g] = [];
        genreMap[g].push(item);
      });
    });
    const topGenres = Object.entries(genreMap).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
    const rows = [];
    if (activeFilter !== 'TV Shows' && movies.length) rows.push({ title: 'Movies', items: movies });
    if (activeFilter !== 'Movies' && shows.length) rows.push({ title: 'TV Shows', items: shows });
    topGenres.forEach(([g, items]) => rows.push({ title: g, items }));
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

        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {library.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Database className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="font-heading font-bold text-xl text-foreground">No Emby content yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {scanProgress.loading
              ? `Scanning your Emby library… ${scanProgress.count} items loaded so far`
              : 'Use "Sync All Libraries" on the Home page to import your Emby content.'}
          </p>
          {!scanProgress.loading && (
            <Button variant="outline" onClick={handleRescan} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Start Scan
            </Button>
          )}
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
          {sections?.map(({ title, items }) => (
            <MediaRow key={title} title={title} items={items} onPlay={handlePlay} />
          ))}
        </div>
      )}

      {playingItem && embyServer && (() => {
        // Extract real Emby item ID from video_url: .../Videos/{embyId}/stream...
        const match = playingItem.video_url?.match(/\/Videos\/([^/]+)\/stream/);
        const embyId = match ? match[1] : playingItem.id;
        return (
          <EmbyVideoPlayer
            item={{ ...playingItem, id: embyId }}
            server={embyServer}
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