import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getLiveStreams, getLiveCategories, getEpgForStream } from '@/lib/xtreamApi';
import { Radio, Search, X, ChevronDown, ChevronRight, Play, Clock, CalendarDays, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function formatTime(timestamp) {
  if (!timestamp) return '';
  // Xtream EPG timestamps are Unix seconds or ISO strings
  const d = typeof timestamp === 'number'
    ? new Date(timestamp * 1000)
    : new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getProgress(start, stop) {
  const now = Date.now();
  const s = typeof start === 'number' ? start * 1000 : new Date(start).getTime();
  const e = typeof stop === 'number' ? stop * 1000 : new Date(stop).getTime();
  if (now < s || !e || !s) return null;
  if (now > e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

function EpgRow({ program, isCurrent }) {
  const progress = isCurrent ? getProgress(program.start_timestamp || program.start, program.stop_timestamp || program.stop) : null;

  return (
    <div className={`px-3 py-2.5 rounded-lg mb-1 ${isCurrent ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
            {program.title || 'Unknown'}
          </p>
          {program.description && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{program.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-[10px] font-mono ${isCurrent ? 'text-primary/80' : 'text-muted-foreground'}`}>
            {formatTime(program.start_timestamp || program.start)}
          </p>
          {isCurrent && <span className="text-[9px] font-bold text-primary">LIVE</span>}
        </div>
      </div>
      {isCurrent && progress !== null && (
        <div className="mt-2 h-1 bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ChannelEpgCard({ channel, server, onPlay }) {
  const [expanded, setExpanded] = useState(false);
  const [epg, setEpg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const loadEpg = useCallback(async () => {
    if (fetched || !server) return;
    setLoading(true);
    setFetched(true);
    try {
      const data = await getEpgForStream(server, channel.stream_id, 6);
      const programs = data?.epg_listings || data?.listing || data || [];
      setEpg(Array.isArray(programs) ? programs : []);
    } catch {
      setEpg([]);
    } finally {
      setLoading(false);
    }
  }, [server, channel.stream_id, fetched]);

  // Auto-load EPG when card becomes visible
  useEffect(() => {
    loadEpg();
  }, [loadEpg]);

  const now = Date.now();
  const currentProgram = epg?.find(p => {
    const s = typeof (p.start_timestamp || p.start) === 'number'
      ? (p.start_timestamp || p.start) * 1000
      : new Date(p.start_timestamp || p.start).getTime();
    const e = typeof (p.stop_timestamp || p.stop) === 'number'
      ? (p.stop_timestamp || p.stop) * 1000
      : new Date(p.stop_timestamp || p.stop).getTime();
    return s <= now && now <= e;
  });

  const upcomingPrograms = epg?.filter(p => {
    const s = typeof (p.start_timestamp || p.start) === 'number'
      ? (p.start_timestamp || p.start) * 1000
      : new Date(p.start_timestamp || p.start).getTime();
    return s > now;
  }).slice(0, 3);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
          {channel.stream_icon ? (
            <img src={channel.stream_icon} alt={channel.name} className="w-full h-full object-contain p-1"
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <Radio className="w-5 h-5 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{channel.name}</p>
          {loading && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" />Loading EPG…</p>}
          {!loading && currentProgram && (
            <p className="text-[10px] text-primary truncate">▶ {currentProgram.title}</p>
          )}
          {!loading && !currentProgram && fetched && (
            <p className="text-[10px] text-muted-foreground">No EPG data</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onPlay(channel); }}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* EPG programs */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2">
          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg bg-secondary" />)}
            </div>
          )}
          {!loading && (!epg || epg.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-3">No EPG data available for this channel.</p>
          )}
          {!loading && epg && epg.length > 0 && (
            <>
              {currentProgram && (
                <div className="mb-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Now Playing</p>
                  <EpgRow program={currentProgram} isCurrent={true} />
                </div>
              )}
              {upcomingPrograms && upcomingPrograms.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Up Next</p>
                  {upcomingPrograms.map((p, i) => <EpgRow key={i} program={p} isCurrent={false} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function EpgGuide({ server, onPlayChannel }) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');

  const { data: categories = [], isLoading: catsLoading } = useQuery({
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

  const isLoading = catsLoading || streamsLoading;

  const filtered = React.useMemo(() => {
    let items = streams;
    if (activeCat !== 'All') {
      const cat = categories.find(c => c.category_name === activeCat);
      if (cat) items = items.filter(i => String(i.category_id) === String(cat.category_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name?.toLowerCase().includes(q));
    }
    return items.slice(0, 100); // cap at 100 to avoid too many EPG calls
  }, [streams, categories, activeCat, search]);

  return (
    <div>
      {/* Search */}
      <div className="px-4 sm:px-6 mb-4 relative">
        <Search className="absolute left-7 sm:left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search channels…"
          className="pl-9 bg-secondary border-border rounded-xl"
        />
        {search && (
          <button className="absolute right-7 sm:right-9 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category pills */}
      {!isLoading && categories.length > 0 && (
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

      {/* Loading skeletons */}
      {isLoading && (
        <div className="px-4 sm:px-6 space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <Skeleton key={i} className="h-16 rounded-xl bg-secondary" />
          ))}
        </div>
      )}

      {/* Info bar */}
      {!isLoading && (
        <div className="px-4 sm:px-6 mb-3 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{filtered.length} channels — click a channel to expand EPG</p>
        </div>
      )}

      {/* Channel list */}
      {!isLoading && (
        <div className="px-4 sm:px-6 space-y-2">
          {filtered.length === 0 && (
            <p className="text-center py-16 text-muted-foreground text-sm">No channels found.</p>
          )}
          {filtered.map(ch => (
            <ChannelEpgCard
              key={ch.stream_id}
              channel={ch}
              server={server}
              onPlay={onPlayChannel}
            />
          ))}
        </div>
      )}
    </div>
  );
}