import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Tv2, Baby, Clock, PlayCircle, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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

  const totalWatchSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);
  const inProgressCount = history.filter(h => !h.completed && h.progress_seconds > 0).length;

  const categories = [
    {
      key: 'movies',
      label: 'Movies',
      icon: Film,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      href: '/movies',
      value: allMedia.filter(m => m.media_type === 'movie' && !IS_4K(m)).length.toLocaleString(),
    },
    {
      key: 'shows',
      label: 'TV Shows',
      icon: Tv2,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
      href: '/shows',
      value: allMedia.filter(m => m.media_type === 'tv_show' && !IS_4K(m)).length.toLocaleString(),
    },
    {
      key: '4k-movies',
      label: '4K Movies',
      icon: Film,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      href: '/movies',
      value: allMedia.filter(m => m.media_type === 'movie' && IS_4K(m)).length.toLocaleString(),
      badge: '4K',
    },
    {
      key: '4k-shows',
      label: '4K TV Shows',
      icon: Tv2,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
      border: 'border-orange-400/20',
      href: '/shows',
      value: allMedia.filter(m => m.media_type === 'tv_show' && IS_4K(m)).length.toLocaleString(),
      badge: '4K',
    },
    {
      key: 'kids',
      label: 'Kids',
      icon: Baby,
      color: 'text-pink-400',
      bg: 'bg-pink-400/10',
      border: 'border-pink-400/20',
      href: '/shows',
      value: allMedia.filter(IS_KIDS).length.toLocaleString(),
    },
    {
      key: 'anime',
      label: 'Anime',
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
  ];

  if (!allMedia.length) return null;

  return (
    <div className="px-4 sm:px-6 mt-6">
      <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
        Library
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map(({ key, label, icon: Icon, color, bg, border, href, value, badge }) => (
          <Link
            key={key}
            to={href}
            className={`relative flex flex-col gap-2 p-4 rounded-xl bg-card border ${border} hover:border-opacity-60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}
          >
            {badge && (
              <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${bg} ${color}`}>
                {badge}
              </span>
            )}
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`font-heading font-bold text-xl leading-none ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}