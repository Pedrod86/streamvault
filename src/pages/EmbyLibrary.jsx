import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Database, Search, Play, Star, Clock, X, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmbyVideoPlayer from '@/components/media/EmbyVideoPlayer';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEmbyFullLibrary } from '@/lib/embyApi';

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

function DetailOverlay({ item, onClose, onPlay }) {
  const backdropUrl = item.backdropUrl || item.posterUrl;
  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden">
        <div className="relative h-48 sm:h-56">
          {backdropUrl ? (
            <img src={backdropUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70" onClick={onClose}>
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
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{item.rating.toFixed(1)}
                  </span>
                )}
                {item.duration && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{Math.floor(item.duration / 60)}h {item.duration % 60}m
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.type === 'Series' ? 'TV Show' : 'Movie'}</Badge>
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
          {item.overview && <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-3">{item.overview}</p>}
          <Button className="w-full bg-primary hover:bg-primary/90 gap-2 rounded-xl" onClick={() => onPlay(item)}>
            <Play className="w-4 h-4 fill-current" />
            {item.type === 'Series' ? 'Play (Direct Stream)' : 'Play Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EmbyLibrary() {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [playingItem, setPlayingItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  // Manual fetch state — bypasses React Query to avoid auth-check issues
  const [embyServer, setEmbyServer] = useState(null);
  const [library, setLibrary] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serversLoading, setServersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setServersLoading(true);
      setError(null);
      try {
        const servers = await base44.entities.MediaServer.list();
        if (cancelled) return;
        const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
        setEmbyServer(server || null);
        setServersLoading(false);

        if (!server) return;

        setIsLoading(true);
        const items = await fetchEmbyFullLibrary(server);
        if (cancelled) return;
        setLibrary(items);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Unknown error');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setServersLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const retry = () => {
    setLibrary([]);
    setError(null);
    setServersLoading(true);
    // re-mount trick: toggle a key instead; just re-call load
    async function load() {
      setServersLoading(true);
      setError(null);
      try {
        const servers = await base44.entities.MediaServer.list();
        const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
        setEmbyServer(server || null);
        setServersLoading(false);
        if (!server) return;
        setIsLoading(true);
        const items = await fetchEmbyFullLibrary(server);
        setLibrary(items);
      } catch (err) {
        setError(err.message || 'Unknown error');
      } finally {
        setIsLoading(false);
        setServersLoading(false);
      }
    }
    load();
  };

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
      item.genres.forEach(g => {
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

  const handlePlay = (item) => { setSelectedItem(null); setPlayingItem(item); };

  if (serversLoading) {
    return (
      <div className="pt-20 pb-24 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!embyServer) {
    return (
      <div className="pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Database className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-heading font-bold text-xl text-foreground">No Emby Server</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Connect an Emby server in Settings to browse your library.
        </p>
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
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground">
              {embyServer.server_name || 'Emby Library'}
            </h1>
            {library.length > 0 && (
              <p className="text-xs text-muted-foreground">{library.length.toLocaleString()} items</p>
            )}
          </div>
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

      {isLoading ? (
        <div className="space-y-8 px-4 sm:px-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground px-0 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading library from {embyServer.server_name || 'Emby'}…</span>
          </div>
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
        <div className="text-center py-16 px-6 space-y-3">
          <p className="text-destructive text-sm font-medium">Failed to load library</p>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto leading-relaxed font-mono bg-secondary rounded-lg px-3 py-2 break-words">{error}</p>
          <button onClick={retry} className="flex items-center gap-2 text-xs text-primary underline mx-auto">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      ) : search.trim() ? (
        <div>
          <p className="text-xs text-muted-foreground px-4 sm:px-6 mb-3">{filtered.length} results for "{search}"</p>
          <div className="flex flex-wrap gap-3 px-4 sm:px-6">
            {filtered.map(item => <MediaCard key={item.id} item={item} onPlay={setSelectedItem} />)}
          </div>
        </div>
      ) : (
        <div>
          {sections?.map(({ title, items }) => (
            <MediaRow key={title} title={title} items={items} onPlay={setSelectedItem} />
          ))}
        </div>
      )}

      {selectedItem && (
        <DetailOverlay item={selectedItem} onClose={() => setSelectedItem(null)} onPlay={handlePlay} />
      )}

      {playingItem && (
        <EmbyVideoPlayer item={playingItem} server={embyServer} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}