import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, Search, Play, Tv, Film, Star, X, Loader2, AlertCircle, ChevronDown, ChevronRight, Layers, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import Hls from 'hls.js';
import {
  getLiveStreams, getLiveCategories,
  getVodStreams, getVodCategories,
  getSeriesStreams, getSeriesCategories,
  getLiveStreamUrl, getVodStreamUrl,
} from '@/lib/xtreamApi';

const TABS = [
  { id: 'live', label: 'Live TV', icon: Radio },
  { id: 'vod', label: 'Movies', icon: Film },
  { id: 'series', label: 'Series', icon: Tv },
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

function MediaCard({ item, onPlay, showRating }) {
  return (
    <div className="cursor-pointer group flex flex-col" onClick={() => onPlay(item)}>
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2">
        {item.stream_icon ? (
          <img
            src={item.stream_icon}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
        </div>
        {showRating && item.rating && parseFloat(item.rating) > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-1.5 py-0.5">
            <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white text-[10px] font-medium">{parseFloat(item.rating).toFixed(1)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground font-medium truncate leading-tight">{item.name}</p>
      {item.year && <p className="text-[10px] text-muted-foreground mt-0.5">{item.year}</p>}
    </div>
  );
}

function CategoryRow({ title, items, tab, onPlay }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const shown = expanded ? items : items.slice(0, 12);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="font-heading font-bold text-sm text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className={tab === 'live'
        ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 px-4 sm:px-6'
        : 'flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2'
      } style={tab !== 'live' ? { scrollbarWidth: 'none' } : {}}>
        {shown.map(item => tab === 'live'
          ? <ChannelCard key={item.stream_id || item.num} item={item} onPlay={onPlay} />
          : <div key={item.stream_id || item.series_id} className="shrink-0 w-[130px] sm:w-[150px]">
              <MediaCard item={item} onPlay={onPlay} showRating />
            </div>
        )}
      </div>
      {items.length > 12 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mx-4 sm:mx-6 mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <><ChevronDown className="w-3 h-3" />Show less</> : <><ChevronRight className="w-3 h-3" />Show all {items.length}</>}
        </button>
      )}
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
        } else if (tab === 'vod') {
          [cats, items] = await Promise.all([getVodCategories(xtreamServer), getVodStreams(xtreamServer)]);
        } else {
          [cats, items] = await Promise.all([getSeriesCategories(xtreamServer), getSeriesStreams(xtreamServer)]);
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
    let url = '';
    if (tab === 'live') {
      // Use m3u8 (HLS) for live streams — better compatibility than .ts
      url = getLiveStreamUrl(xtreamServer, item.stream_id, 'm3u8');
    } else if (tab === 'vod') {
      url = getVodStreamUrl(xtreamServer, item.stream_id, item.container_extension || 'mp4');
    } else {
      url = getVodStreamUrl(xtreamServer, item.series_id, 'mp4');
    }
    setPlaying({ url, name: item.name, id: item.stream_id || item.series_id });
  };

  // Fake server object for EmbyVideoPlayer compatibility
  const fakeServer = xtreamServer ? { server_url: '', api_token: '' } : null;
  const fakeItem = playing ? {
    id: playing.id,
    title: playing.name,
    _directUrl: playing.url,
  } : null;

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

      {/* Search */}
      <div className="px-4 sm:px-6 mb-4 relative">
        <Search className="absolute left-7 sm:left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${tab === 'live' ? 'channels' : tab === 'vod' ? 'movies' : 'series'}…`}
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
              <div className={tab === 'live' ? 'grid grid-cols-3 sm:grid-cols-6 gap-3' : 'flex gap-3'}>
                {[1,2,3,4,5,6].map(j => (
                  <Skeleton key={j} className={`rounded-xl bg-secondary shrink-0 ${tab === 'live' ? 'aspect-video' : 'w-[130px] h-[200px]'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mx-4 sm:mx-6 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grouped rows (default view) */}
      {!loading && !error && grouped && (
        <div>
          {grouped.map(([catName, items]) => (
            <CategoryRow key={catName} title={catName} items={items} tab={tab} onPlay={handlePlay} />
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
              <div className={tab === 'live'
                ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3'
              }>
                {filtered.map(item => tab === 'live'
                  ? <ChannelCard key={item.stream_id} item={item} onPlay={handlePlay} />
                  : <MediaCard key={item.stream_id || item.series_id} item={item} onPlay={handlePlay} showRating />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Player — use a simple HTML5 video overlay for IPTV streams */}
      {playing && (
        <IptvPlayer url={playing.url} title={playing.name} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function IptvPlayer({ url, title, onClose }) {
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);
  const [playerId, setPlayerId] = React.useState('hls');
  const [showPicker, setShowPicker] = React.useState(false);

  const IPTV_PLAYERS = [
    { id: 'mpv', label: 'MPV', description: 'Open in MPV media player (must be installed)' },
    { id: 'vlc', label: 'VLC', description: 'Open in VLC media player (must be installed)' },
    { id: 'hls', label: 'HLS (Browser)', description: 'Play in browser via hls.js' },
    { id: 'direct', label: 'Direct (Browser)', description: 'Native browser playback' },
  ];

  const isExternal = playerId === 'mpv' || playerId === 'vlc';

  const schemeMap = {
    mpv: `mpv://${url}`,
    vlc: `vlc://${url}`,
  };

  // Browser-side HLS/direct playback — all IPTV streams go through backend proxy to avoid CORS
  React.useEffect(() => {
    if (isExternal) return;
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    async function startHls() {
      if (!Hls.isSupported()) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      // Fetch the m3u8 through the backend proxy to bypass CORS
      let playlistText = null;
      try {
        const res = await base44.functions.invoke('streamProxy', { url });
        playlistText = res?.data?.content;
      } catch (_) {}

      if (!playlistText) {
        // Fallback: try direct
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      // Rewrite segment lines to go through the proxy
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const rewritten = playlistText.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        // Keep as a special marker so our custom loader can pick it up
        return `proxy::${absUrl}`;
      }).join('\n');

      // Custom hls.js loader that intercepts proxy:: URLs
      const defaultLoader = Hls.DefaultConfig.loader;
      class ProxyLoader extends defaultLoader {
        load(context, config, callbacks) {
          if (context.url.startsWith('proxy::')) {
            const realUrl = context.url.slice(7);
            base44.functions.invoke('streamProxy', { url: realUrl }).then(res => {
              const content = res?.data?.content;
              if (content) {
                callbacks.onSuccess({ data: content, url: context.url }, { code: 200, text: '' }, context);
              } else {
                callbacks.onError({ code: 0, text: 'proxy error' }, context, null);
              }
            }).catch(() => callbacks.onError({ code: 0, text: 'proxy error' }, context, null));
          } else {
            super.load(context, config, callbacks);
          }
        }
      }

      const blob = new Blob([rewritten], { type: 'application/vnd.apple.mpegurl' });
      const blobUrl = URL.createObjectURL(blob);

      const hls = new Hls({ enableWorker: false, lowLatencyMode: true, loader: ProxyLoader });
      hlsRef.current = hls;
      hls.loadSource(blobUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) { hls.destroy(); hlsRef.current = null; }
      });
    }

    startHls();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [url, playerId, isExternal]);

  const playerLabel = IPTV_PLAYERS.find(p => p.id === playerId)?.label || 'MPV';

  // External player screen
  if (isExternal) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6 p-8">
        <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        {/* Player picker */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20"
          >
            <Layers className="w-3.5 h-3.5" /> {playerLabel}
          </button>
          {showPicker && (
            <div className="absolute top-10 right-0 w-64 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-white text-sm font-semibold">Choose Player</span>
                <button onClick={() => setShowPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
              </div>
              <div className="p-2 space-y-1">
                {IPTV_PLAYERS.map(p => (
                  <button key={p.id} onClick={() => { setPlayerId(p.id); setShowPicker(false); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${playerId === p.id ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}>
                    <div>
                      <div className="text-xs font-semibold">{p.label}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ExternalLinkIcon className="w-14 h-14 text-primary" />
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-white text-xl font-bold">{title}</h2>
          <p className="text-white/60 text-sm">Ready to open in <span className="text-primary font-semibold">{playerLabel}</span></p>
          <p className="text-white/30 text-xs mt-2 break-all">{url}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { const a = document.createElement('a'); a.href = schemeMap[playerId]; a.click(); }}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            <ExternalLinkIcon className="w-4 h-4" /> Open in {playerLabel}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(url)}
            className="w-full py-3 rounded-xl bg-white/10 text-white font-medium text-sm"
          >
            Copy Stream URL
          </button>
        </div>
        <p className="text-white/25 text-xs text-center max-w-xs">{playerLabel} must be installed on your device.</p>
      </div>
    );
  }

  // Browser player screen
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/80 text-sm font-medium truncate max-w-[200px]">{title}</span>
        <div className="relative">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20"
          >
            <Layers className="w-3.5 h-3.5" /> {playerLabel}
          </button>
          {showPicker && (
            <div className="absolute top-10 right-0 w-64 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-white text-sm font-semibold">Choose Player</span>
                <button onClick={() => setShowPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
              </div>
              <div className="p-2 space-y-1">
                {IPTV_PLAYERS.map(p => (
                  <button key={p.id} onClick={() => { setPlayerId(p.id); setShowPicker(false); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${playerId === p.id ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}>
                    <div>
                      <div className="text-xs font-semibold">{p.label}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        controls
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
      />
    </div>
  );
}