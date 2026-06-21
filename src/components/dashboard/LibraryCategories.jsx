import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv2, Baby, Clock, PlayCircle, Sparkles, Loader2, Clapperboard, MonitorPlay, Trophy, BookOpen, Library } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { scanState, runScan } from '@/lib/embyScanState';
import { loadCounts, saveCounts } from '@/lib/embyCountsCache';


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

  // Audiobooks/Books live in a separate Emby item type, so count them on their own.
  const { data: booksCount = null } = useQuery({
    queryKey: ['embyBooksCount'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyAudiobooks', { startIndex: 0, pageSize: 1 });
      return res.data?.totalCount ?? 0;
    },
    staleTime: 10 * 60 * 1000,
  });

  // True live totals straight from Emby (TotalRecordCount) — accurate even
  // though the background scan has only paged through part of the library.
  const { data: liveTotals = null } = useQuery({
    queryKey: ['embyCategoryCounts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyCategoryCounts', {});
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
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

  // Prefer the real Emby totals; fall back to scanned counts when unavailable.
  const embyMovies = liveTotals?.movies ?? counts.movies;
  const embyShows = liveTotals?.shows ?? counts.shows;
  const embyKids = liveTotals?.kids ?? counts.kids;
  const embyAnime = liveTotals?.anime ?? counts.anime;
  const embySports = liveTotals?.sports ?? counts.sports;
  // Prefer the real Emby 4K totals (Is4K filter); fall back to scanned counts.
  const emby4kMovies = liveTotals?.fourkMovies ?? counts.fourkMovies;
  const emby4kShows = liveTotals?.fourkShows ?? counts.fourkShows;
  // Only show "…" if we have no live totals AND no scanned/cached count.
  const embyLoading = !liveTotals && embyScan.loading && !hasLive && !cachedCounts;
  const embySyncing = embyScan.loading;

  const totalWatchSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);
  const inProgressCount = history.filter(h => !h.completed && h.progress_seconds > 0).length;



  const embyTotal = embyScan.library.length;
  const hasEmby = embyTotal > 0 || embySyncing;

  // Plex brand amber/gold for every box
  const embyColor = 'text-[#e5a00d]';
  const embyBg = 'bg-[#e5a00d]/10';
  const embyBorder = 'border-[#e5a00d]/25';

  const categories = [
    {
      key: 'emby-movies',
      label: 'Emby Movies',
      icon: Film,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/emby',
      value: embyLoading ? '…' : embyMovies.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-shows',
      label: 'Emby TV Shows',
      icon: Tv2,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/emby',
      value: embyLoading ? '…' : embyShows.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-4k',
      label: '4K Movies',
      icon: Clapperboard,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/4k',
      value: embyLoading ? '…' : emby4kMovies.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'emby-4k-tv',
      label: '4K TV Shows',
      icon: MonitorPlay,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/4k',
      value: embyLoading ? '…' : emby4kShows.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'kids',
      label: 'Emby Kids TV',
      icon: Baby,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/shows',
      value: embyLoading ? '…' : embyKids.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'anime',
      label: 'Emby Anime',
      icon: Sparkles,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/shows',
      value: embyLoading ? '…' : embyAnime.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'sports',
      label: 'Sports Replays',
      icon: Trophy,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/emby?filter=Sports',
      value: embyLoading ? '…' : embySports.toLocaleString(),
      syncing: embySyncing,
    },
    {
      key: 'books',
      label: 'Audiobooks',
      icon: BookOpen,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/audiobooks',
      value: booksCount === null ? '…' : booksCount.toLocaleString(),
    },
    {
      key: 'watchtime',
      label: 'Watch Time',
      icon: Clock,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/history',
      value: totalWatchSeconds > 0 ? formatWatchTime(totalWatchSeconds) : '0m',
    },
    {
      key: 'inprogress',
      label: 'In Progress',
      icon: PlayCircle,
      color: embyColor,
      bg: embyBg,
      border: embyBorder,
      href: '/history',
      value: inProgressCount,
    },

  ];

  return (
    <div className="px-4 sm:px-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-1.5 font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          <Library className="w-4 h-4 text-[#e5a00d]" />
          Library
        </h2>
        <div className="flex items-center gap-2 ml-auto">
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