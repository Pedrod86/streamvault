import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv2, Baby, Clock, PlayCircle, Sparkles, Loader2, Clapperboard, MonitorPlay, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { scanState, runScan } from '@/lib/embyScanState';
import { loadCounts, saveCounts } from '@/lib/embyCountsCache';
import QuickSyncButton from '@/components/dashboard/QuickSyncButton';

const IS_4K = (m) =>
  !!m && (
    m.tags?.some(t => /4k|2160p|uhd/i.test(t)) ||
    !!(m.title?.match(/\b(4K|UHD|2160p)\b/i))
  );

// Scan items use `genres` + `contentRating`; DB items use `genre` + `content_rating`.
// Normalise both so the counters work on either shape.
const genresOf = (m) => m.genres || m.genre || [];
const tagsOf = (m) => m.tags || [];
const ratingOf = (m) => m.contentRating || m.content_rating || '';

const IS_KIDS = (m) =>
  tagsOf(m).some(t => /^kids?$/i.test(t)) ||
  genresOf(m).some(g => /kids?|children|family/i.test(g)) ||
  ['TV-Y', 'TV-G', 'G', 'TV-Y7'].includes(ratingOf(m));

const IS_ANIME = (m) =>
  tagsOf(m).some(t => /^anime$/i.test(t)) ||
  genresOf(m).some(g => /anime|animation/i.test(g));

const IS_SPORTS = (m) =>
  tagsOf(m).some(t => /^sports?$/i.test(t)) ||
  genresOf(m).some(g => /^sports?$/i.test(g));

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

  // Subscribe to the shared Emby scan state (no extra API calls)
  const [embyScan, setEmbyScan] = useState({ ...scanState });
  useEffect(() => {
    const listener = (state) => setEmbyScan({ ...state });
    scanState.listeners.add(listener);
    setEmbyScan({ ...scanState });
    runScan(); // no-op if already running/done
    return () => scanState.listeners.delete(listener);
  }, []);

  // Last-known counts from the previous time this server was used — lets the
  // boxes fill instantly while a fresh scan runs in the background.
  const [cachedCounts] = useState(() => loadCounts());

  const hasLive = embyScan.library.length > 0;

  const liveCounts = {
    movies: embyScan.library.filter(i => i.type === 'Movie').length,
    shows: embyScan.library.filter(i => i.type === 'Series').length,
    fourkMovies: embyScan.library.filter(i => i.type === 'Movie' && IS_4K(i)).length,
    fourkShows: embyScan.library.filter(i => i.type === 'Series' && IS_4K(i)).length,
    kids: embyScan.library.filter(i => IS_KIDS(i)).length,
    anime: embyScan.library.filter(i => IS_ANIME(i)).length,
    sports: embyScan.library.filter(i => IS_SPORTS(i)).length,
  };

  // Prefer live data; fall back to the cached counts until the scan loads items.
  const counts = hasLive ? liveCounts : (cachedCounts || liveCounts);

  // Persist live counts so they're available instantly on the next visit.
  useEffect(() => {
    if (hasLive) saveCounts(liveCounts);
  }, [hasLive, liveCounts.movies, liveCounts.shows, liveCounts.fourkMovies, liveCounts.fourkShows, liveCounts.kids, liveCounts.anime, liveCounts.sports]); // eslint-disable-line react-hooks/exhaustive-deps

  const embyMovies = counts.movies;
  const embyShows = counts.shows;
  const emby4kMovies = counts.fourkMovies;
  const emby4kShows = counts.fourkShows;
  const embyKids = counts.kids;
  const embyAnime = counts.anime;
  const embySports = counts.sports;
  // Only show "…" if we have neither live data nor a cached count to display.
  const embyLoading = embyScan.loading && !hasLive && !cachedCounts;
  const embySyncing = embyScan.loading;

  const totalWatchSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);
  const inProgressCount = history.filter(h => !h.completed && h.progress_seconds > 0).length;



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
      key: 'emby-4k',
      label: '4K Library',
      icon: Clapperboard,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      href: '/4k',
      value: embyLoading ? '…' : (emby4kMovies + emby4kShows).toLocaleString(),
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
      value: embyLoading ? '…' : embyKids.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'anime',
      label: 'Emby Anime',
      icon: Sparkles,
      color: 'text-rose-400',
      bg: 'bg-rose-400/10',
      border: 'border-rose-400/20',
      href: '/shows',
      value: embyLoading ? '…' : embyAnime.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'sports',
      label: 'Sports Replays',
      icon: Trophy,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      border: 'border-green-400/20',
      href: '/emby?filter=Sports',
      value: embyLoading ? '…' : embySports.toLocaleString(),
      syncing: embySyncing,
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

  ];

  return (
    <div className="px-4 sm:px-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Library
        </h2>
        <div className="flex items-center gap-2 ml-auto">
        <QuickSyncButton />
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