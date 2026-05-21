import React, { useState, useEffect, useMemo } from 'react';
import { Database, Search, Play, Star, Clock, X, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';
import { Skeleton } from '@/components/ui/skeleton';
import { scanState, resetScan, runScan } from '@/lib/embyScanState';

function MediaCard({ item, onPlay }) {
  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group" onClick={() => onPlay(item)}>
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => <MediaCard key={item.id} item={item} onPlay={onPlay} />)}
      </div>
    </div>
  );
}

export default function EmbyLibrary() {
  const [scan, setScan] = useState({ ...scanState });
  const [search, setSearch] = useState('');
  const [playingItem, setPlayingItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const listener = (state) => setScan({ ...state });
    scanState.listeners.add(listener);
    setScan({ ...scanState });
    return () => { scanState.listeners.delete(listener); };
  }, []);

  const resetAndRescan = () => {
    resetScan();
    runScan();
  };

  const library = scan.library;
  const embyServer = scan.server;
  const isFirstLoad = library.length === 0 && scan.loading;
  const hasMore = !scan.done && !scan.loading;
  const totalKnown = scan.total || 0;

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

  const sections = useMemo(() => {
    if (search.trim()) return null;
    const movies = filtered.filter(i => i.type === 'Movie');
    const shows = filtered.filter(i => i.type === 'Series');
    const genreMap = {};
    filtered.forEach(item => {
      item.genres?.forEach(g => {
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

  if (isFirstLoad) {
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

  if (scan.error && library.length === 0) {
    return (
      <div className="pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Database className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl text-foreground">Failed to load</h2>
        <p className="text-sm text-muted-foreground max-w-sm font-mono bg-secondary rounded-lg px-3 py-2 break-words">{scan.error}</p>
        <Button variant="outline" onClick={resetAndRescan} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {library.length.toLocaleString()}{totalKnown > 0 ? ` / ${totalKnown.toLocaleString()}` : ''} items
              </p>
              {scan.loading && (
                <span className="flex items-center gap-1 text-[10px] text-accent">
                  <Loader2 className="w-3 h-3 animate-spin" /> loading…
                </span>
              )}
              {scan.done && (
                <span className="text-[10px] text-green-400">✓ all loaded</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetAndRescan} className="gap-1.5 text-xs text-muted-foreground">
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

      {search.trim() ? (
        <div>
          <p className="text-xs text-muted-foreground px-4 sm:px-6 mb-3">{filtered.length} results for "{search}"</p>
          <div className="flex flex-wrap gap-3 px-4 sm:px-6">
            {filtered.map(item => <MediaCard key={item.id} item={item} onPlay={setPlayingItem} />)}
          </div>
        </div>
      ) : (
        <div>
          {sections?.map(({ title, items }) => (
            <MediaRow key={title} title={title} items={items} onPlay={setPlayingItem} />
          ))}
        </div>
      )}

      {/* Load more button — only fetch next page when user asks */}
      {!search.trim() && (hasMore || scan.loading) && (
        <div className="flex justify-center px-4 py-6">
          {scan.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading more…
            </div>
          ) : (
            <Button variant="outline" onClick={runScan} className="gap-2">
              <ChevronDown className="w-4 h-4" />
              Load more ({library.length.toLocaleString()} of {totalKnown.toLocaleString()})
            </Button>
          )}
        </div>
      )}

      {playingItem && (
        <EmbyVideoPlayer item={playingItem} server={embyServer} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}