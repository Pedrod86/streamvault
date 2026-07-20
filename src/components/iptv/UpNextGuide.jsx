import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLiveStreams, getLiveCategories, getEpgForStream } from '@/lib/xtreamApi';
import { Radio, Search, X, Play, Clock, CalendarClock, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// Xtream short-EPG titles/descriptions are base64 encoded
function decode(str) {
  if (!str) return '';
  try {
    const decoded = atob(str);
    // If it decodes to readable text, use it; otherwise fall back to raw
    return /[\x00-\x08\x0e-\x1f]/.test(decoded) ? str : decoded;
  } catch {
    return str;
  }
}

function toMs(ts) {
  if (ts == null) return NaN;
  return typeof ts === 'number' || /^\d+$/.test(String(ts))
    ? Number(ts) * 1000
    : new Date(ts).getTime();
}

function formatTime(ms) {
  if (!ms || Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ms) {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// How many channels to pull EPG for — keeps the number of requests reasonable
const CHANNEL_LIMIT = 40;

export default function UpNextGuide({ server, onPlayChannel }) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [programs, setPrograms] = useState([]);
  const [loadingEpg, setLoadingEpg] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['liveCategories', server?.id],
    queryFn: () => getLiveCategories(server),
    enabled: !!server,
    staleTime: 10 * 60 * 1000,
  });

  const { data: streams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ['liveStreams', server?.id],
    queryFn: () => getLiveStreams(server),
    enabled: !!server,
    staleTime: 10 * 60 * 1000,
  });

  const channels = useMemo(() => {
    let items = streams;
    if (activeCat !== 'All') {
      const cat = categories.find(c => c.category_name === activeCat);
      if (cat) items = items.filter(i => String(i.category_id) === String(cat.category_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name?.toLowerCase().includes(q));
    }
    return items.slice(0, CHANNEL_LIMIT);
  }, [streams, categories, activeCat, search]);

  // Fetch upcoming programs across the selected channels
  useEffect(() => {
    if (!server || channels.length === 0) { setPrograms([]); return; }
    let cancelled = false;
    setLoadingEpg(true);
    setPrograms([]);

    (async () => {
      const now = Date.now();
      const results = await Promise.allSettled(
        channels.map(ch => getEpgForStream(server, ch.stream_id, 4).then(data => ({ ch, data })))
      );
      if (cancelled) return;

      const collected = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { ch, data } = r.value;
        const listings = data?.epg_listings || data?.listing || (Array.isArray(data) ? data : []);
        if (!Array.isArray(listings)) continue;
        for (const p of listings) {
          const start = toMs(p.start_timestamp || p.start);
          const stop = toMs(p.stop_timestamp || p.stop || p.end);
          if (Number.isNaN(start) || start <= now) continue; // only upcoming
          collected.push({
            key: `${ch.stream_id}-${start}`,
            channel: ch,
            title: decode(p.title) || 'Unknown programme',
            description: decode(p.description),
            start,
            stop,
          });
        }
      }
      collected.sort((a, b) => a.start - b.start);
      setPrograms(collected.slice(0, 100));
      setLoadingEpg(false);
    })();

    return () => { cancelled = true; };
  }, [server?.id, channels]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of programs) {
      const label = dayLabel(p.start);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(p);
    }
    return Array.from(map.entries());
  }, [programs]);

  const isLoading = streamsLoading || loadingEpg;

  return (
    <div>
      {/* Search */}
      <div className="px-4 sm:px-6 mb-4 relative">
        <Search className="absolute left-7 sm:left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter channels…"
          className="pl-9 bg-secondary border-border rounded-xl"
        />
        {search && (
          <button className="absolute right-7 sm:right-9 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCat('All')}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCat === 'All' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.category_id}
              onClick={() => setActiveCat(cat.category_name)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCat === cat.category_name ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
            >
              {cat.category_name}
            </button>
          ))}
        </div>
      )}

      {/* Info bar */}
      <div className="px-4 sm:px-6 mb-3 flex items-center gap-2">
        <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Loading schedule…' : `${programs.length} upcoming programmes across ${channels.length} channels`}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="px-4 sm:px-6 space-y-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-secondary" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && programs.length === 0 && (
        <div className="text-center py-16 px-6 text-muted-foreground text-sm">
          No upcoming programme data available for these channels.
        </div>
      )}

      {/* Grouped upcoming list */}
      {!isLoading && grouped.map(([label, items]) => (
        <div key={label} className="mb-4">
          <div className="sticky top-0 z-10 px-4 sm:px-6 py-1.5 bg-background/90 backdrop-blur">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          </div>
          <div className="px-4 sm:px-6 space-y-1.5">
            {items.map(p => (
              <div key={p.key} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                {/* Time */}
                <div className="shrink-0 w-12 text-center">
                  <p className="text-sm font-mono font-semibold text-primary tabular-nums">{formatTime(p.start)}</p>
                  {p.stop ? <p className="text-[9px] text-muted-foreground font-mono">{formatTime(p.stop)}</p> : null}
                </div>

                {/* Channel logo */}
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                  {p.channel.stream_icon ? (
                    <img src={p.channel.stream_icon} alt={p.channel.name} className="w-full h-full object-contain p-1"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <Radio className="w-4 h-4 text-muted-foreground/60" />
                  )}
                </div>

                {/* Program info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.channel.name}</p>
                </div>

                {/* Play channel */}
                <button
                  onClick={() => onPlayChannel(p.channel)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors shrink-0"
                  aria-label={`Watch ${p.channel.name}`}
                >
                  <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}