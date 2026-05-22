import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv2, Baby, Clock, PlayCircle, Sparkles, Database, Loader2, Radio, Clapperboard, MonitorPlay } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { scanState, runScan } from '@/lib/embyScanState';
import { getLiveStreams } from '@/lib/xtreamApi';

const IS_4K = (m) =>
  m.tags?.some(t => /4k|2160p|uhd/i.test(t)) ||
  m.title?.match(/\b(4K|UHD|2160p)\b/i);

const IS_KIDS = (m) =>
  m.tags?.some(t => /^kids?$/.test(t)) ||
  m.genre?.some(g => /kids?|children|family/i.test(g)) ||
  ['TV-Y', 'TV-G', 'G', 'TV-Y7'].includes(m.content_rating);

const IS_ANIME = (m) =>
  m.tags?.some(t => /^anime$/.test(t)) ||
  m.genre?.some(g => /^anime$/i.test(g));

function formatWatchTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryCategories({ allMedia = [] }) {
  const { data: history = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  // Subscribe to the shared Emby scan state (no extra API calls)
  const [embyScan, setEmbyScan] = useState({ ...scanState });
  useEffect(() => {
    const listener = (state) => setEmbyScan({ ...state });
    scanState.listeners.add(listener);
    setEmbyScan({ ...scanState });
    runScan(); // no-op if already running/done
    return () => scanState.listeners.delete(listener);
  }, []);

  const embyMovies = embyScan.library.filter(i => i.type === 'Movie').length;
  const embyShows = embyScan.library.filter(i => i.type === 'Series').length;
  const emby4kMovies = embyScan.library.filter(i => i.type === 'Movie' && IS_4K(i)).length;
  const emby4kShows = embyScan.library.filter(i => i.type === 'Series' && IS_4K(i)).length;
  const embyLoading = embyScan.loading && embyScan.library.length === 0;
  const embySyncing = embyScan.loading;

  const totalWatchSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);
  const inProgressCount = history.filter(h => !h.completed && h.progress_seconds > 0).length;

  // Live streams count from Xtream server
  const [liveCount, setLiveCount] = useState(null);
  const xtreamServer = servers?.find(s => s.server_type === 'xtream');
  useEffect(() => {
    if (!xtreamServer) return;
    getLiveStreams(xtreamServer)
      .then(data => setLiveCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setLiveCount(0));
  }, [xtreamServer?.id]);

  const embyTotal = embyScan.library.length;
  const hasEmby = embyTotal > 0 || embySyncing;

  const categories = [
    {
      key: 'emby-movies',
      label: 'Emby Movies',
      icon: Film,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      href: '/emby',
      value: embyLoading ? '…' : embyMovies.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-shows',
      label: 'Emby TV Shows',
      icon: Tv2,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
      href: '/emby',
      value: embyLoading ? '…' : embyShows.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-4k-movies',
      label: 'Emby 4K Movies',
      icon: Clapperboard,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      href: '/emby',
      value: embyLoading ? '…' : emby4kMovies.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-4k-tv',
      label: 'Emby 4K TV',
      icon: MonitorPlay,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
      border: 'border-orange-400/20',
      href: '/emby',
      value: embyLoading ? '…' : emby4kShows.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'kids',
      label: 'Emby Kids TV',
      icon: Baby,
      color: 'text-pink-400',
      bg: 'bg-pink-400/10',
      border: 'border-pink-400/20',
      href: '/shows',
      value: allMedia.filter(IS_KIDS).length.toLocaleString(),
    },
    {
      key: 'anime',
      label: 'Emby Anime',
      icon: Sparkles,
      color: 'text-rose-400',
      bg: 'bg-rose-400/10',
      border: 'border-rose-400/20',
      href: '/shows',
      value: allMedia.filter(IS_ANIME).length.toLocaleString(),
    },
    {
      key: 'watchtime',
      label: 'Watch Time',
      icon: Clock,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      href: '/history',
      value: totalWatchSeconds > 0 ? formatWatchTime(totalWatchSeconds) : '0m',
    },
    {
      key: 'inprogress',
      label: 'In Progress',
      icon: PlayCircle,
      color: 'text-accent',
      bg: 'bg-accent/10',
      border: 'border-accent/20',
      href: '/history',
      value: inProgressCount,
    },
    ...(xtreamServer ? [{
      key: 'live',
      label: 'Live Streams',
      icon: Radio,
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      border: 'border-red-400/20',
      href: '/iptv',
      value: liveCount === null ? '…' : liveCount.toLocaleString(),
      live: true,
    }] : []),
  ];

  return (
    <div className="px-4 sm:px-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Library
        </h2>
        {embySyncing && (
          <span className="flex items-center gap-1 text-[10px] text-accent">
            <Loader2 className="w-3 h-3 animate-spin" />
            Syncing Emby ({embyTotal.toLocaleString()} loaded)
          </span>
        )}
        {embyScan.done && embyTotal > 0 && (
          <span className="text-[10px] text-green-400">✓ {embyTotal.toLocaleString()} items</span>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {categories.map(({ key, label, icon: Icon, color, bg, border, href, value, syncing, live }) => (
          <Link
            key={key}
            to={href}
            className={`relative flex items-center gap-2 p-2.5 rounded-lg bg-card border ${border} hover:border-opacity-60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}
          >
            {syncing && (
              <Loader2 className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-accent animate-spin" />
            )}
            {live && (
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
            <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className={`font-heading font-bold text-sm leading-none ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}