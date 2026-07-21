import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, Search, Play, X, AlertCircle, CalendarDays, CalendarClock } from 'lucide-react';
import ExoPlayer from '@/components/media/ExoPlayer';
import EpgGuide from '@/components/iptv/EpgGuide';
import UpNextGuide from '@/components/iptv/UpNextGuide';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  getLiveStreams, getLiveCategories,
  getLiveStreamUrl,
} from '@/lib/xtreamApi';
import ExternalPlayerButton from '@/components/media/ExternalPlayerButton';

const TABS = [
  { id: 'live', label: 'Live TV', icon: Radio },
  { id: 'upnext', label: 'Up Next', icon: CalendarClock },
  { id: 'epg', label: 'EPG Guide', icon: CalendarDays },
];

function ChannelCard({ item, onPlay }) {
  return (
    <div
      className="cursor-pointer group flex flex-col"
      onClick={() => onPlay(item)}
    >
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-video mb-2 flex items-center justify-center">
        {item.stream_icon ? (
          <img
            src={item.stream_icon}
            alt={item.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <Radio className="w-8 h-8 text-muted-foreground/40" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/90 text-white">LIVE</span>
        </div>
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.name}</p>
    </div>
  );
}

function CategoryRow({ title, items, onPlay }) {
  if (!items.length) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="font-heading font-bold text-sm text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 px-4 sm:px-6">
        {items.map(item => (
          <ChannelCard key={item.stream_id || item.num} item={item} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

export default function IPTV() {
  const [tab, setTab] = useState('live');
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [playing, setPlaying] = useState(null); // { url, name }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streams, setStreams] = useState([]);
  const [categories, setCategories] = useState([]);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  const xtreamServer = servers.find(s => s.server_type === 'xtream');

  // Load streams whenever tab or server changes
  useEffect(() => {
    if (!xtreamServer) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStreams([]);
    setCategories([]);
    setActiveCat('All');

    const loadData = async () => {
      try {
        let cats = [], items = [];
        if (tab === 'live') {
          [cats, items] = await Promise.all([getLiveCategories(xtreamServer), getLiveStreams(xtreamServer)]);
        } else {
          // epg tab — no streams to load
          if (!cancelled) setLoading(false);
          return;
        }
        if (!cancelled) {
          setCategories(cats || []);
          setStreams(items || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [tab, xtreamServer?.id]);

  const filtered = useMemo(() => {
    let items = streams;
    if (activeCat !== 'All') {
      const cat = categories.find(c => c.category_name === activeCat);
      if (cat) items = items.filter(i => String(i.category_id) === String(cat.category_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name?.toLowerCase().includes(q));
    }
    return items;
  }, [streams, activeCat, search, categories]);

  // Group by category when not filtered
  const grouped = useMemo(() => {
    if (search.trim() || activeCat !== 'All') return null;
    const map = {};
    const catById = {};
    categories.forEach(c => { catById[String(c.category_id)] = c.category_name; });
    streams.forEach(item => {
      const catName = catById[String(item.category_id)] || 'Other';
      if (!map[catName]) map[catName] = [];
      map[catName].push(item);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [streams, categories, search, activeCat]);

  const handlePlay = (item) => {
    // Use m3u8 (HLS) for the in-app player — better compatibility than .ts.
    // Keep the raw .ts URL for external players (VLC/MX etc. handle it directly).
    const url = getLiveStreamUrl(xtreamServer, item.stream_id, 'm3u8');
    const externalUrl = getLiveStreamUrl(xtreamServer, item.stream_id, 'ts');
    setPlaying({ url, externalUrl, name: item.name, id: item.stream_id });
  };

  if (!xtreamServer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Radio className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-heading font-bold text-xl text-foreground">No IPTV Server</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Connect an Xtream Codes IPTV server to browse your playlist here.
        </p>
        <Link
          to="/connect-server"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <Radio className="w-4 h-4" /> Connect IPTV
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-24">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 mb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Radio className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-lg text-foreground">IPTV</h1>
          <p className="text-xs text-muted-foreground">{xtreamServer.server_name || xtreamServer.server_url}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 sm:px-6 mb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* EPG tab renders its own UI */}
      {tab === 'epg' && !xtreamServer && (
        <div className="mx-4 sm:mx-6 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" /><span>No IPTV server connected.</span>
        </div>
      )}

      {tab === 'live' && (
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
      {!loading && categories.length > 0 && (
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

      {/* Loading */}
      {loading && (
        <div className="px-4 sm:px-6 space-y-6 mt-2">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <Skeleton className="h-4 w-32 mb-3 bg-secondary" />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[1,2,3,4,5,6].map(j => (
                  <Skeleton key={j} className="rounded-xl bg-secondary shrink-0 aspect-video" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mx-4 sm:mx-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Couldn't load the channel list</p>
            <p className="text-amber-300/80 text-xs leading-relaxed">
              Your IPTV provider is blocking connections from the app's servers. You can still watch — open individual streams with the <span className="font-semibold">External Player</span> (VLC/MX), which connects directly from your device.
            </p>
          </div>
        </div>
      )}

      {/* Grouped rows (default view) */}
      {!loading && !error && grouped && (
        <div>
          {grouped.map(([catName, items]) => (
            <CategoryRow key={catName} title={catName} items={items} onPlay={handlePlay} />
          ))}
        </div>
      )}

      {/* Filtered flat grid */}
      {!loading && !error && !grouped && (
        <div className="px-4 sm:px-6">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No results found.</div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">{filtered.length} results</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {filtered.map(item => (
                  <ChannelCard key={item.stream_id} item={item} onPlay={handlePlay} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      </div>
      )}{/* end tab === live */}

      {/* Up Next tab — chronological upcoming programmes across channels */}
      {tab === 'upnext' && (
        <UpNextGuide server={xtreamServer} onPlayChannel={(ch) => {
          setPlaying({
            url: getLiveStreamUrl(xtreamServer, ch.stream_id, 'm3u8'),
            externalUrl: getLiveStreamUrl(xtreamServer, ch.stream_id, 'ts'),
            name: ch.name, id: ch.stream_id,
          });
        }} />
      )}

      {/* EPG Guide tab */}
      {tab === 'epg' && (
        <EpgGuide server={xtreamServer} onPlayChannel={(ch) => {
          setPlaying({
            url: getLiveStreamUrl(xtreamServer, ch.stream_id, 'm3u8'),
            externalUrl: getLiveStreamUrl(xtreamServer, ch.stream_id, 'ts'),
            name: ch.name, id: ch.stream_id,
          });
        }} />
      )}

      {/* Player */}
      {playing && (
        <>
          <ExoPlayer src={playing.url} title={playing.name} onClose={() => setPlaying(null)} />
          {/* External-player launcher — floats above the in-app player */}
          <div className="fixed top-4 right-16 z-[60]">
            <ExternalPlayerButton
              streamUrl={playing.externalUrl || playing.url}
              title={playing.name}
              variant="icon"
              className="bg-black/50 backdrop-blur-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}