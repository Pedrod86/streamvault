import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, Film, Tv2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatWatchTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StatsWidget() {
  const { data: history = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Total watch time = sum of progress_seconds across all history entries
  const totalWatchSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);

  // Unfinished = media items that have a history entry but aren't completed
  const unfinishedIds = new Set(
    history.filter(h => !h.completed && h.progress_seconds > 0).map(h => h.media_id)
  );

  // Items in library with no history at all (never started)
  const startedIds = new Set(history.map(h => h.media_id));
  const unwatchedMovies = allMedia.filter(m => m.media_type === 'movie' && !startedIds.has(m.id)).length;
  const unwatchedShows = allMedia.filter(m => m.media_type === 'tv_show' && !startedIds.has(m.id)).length;

  const stats = [
    {
      icon: Clock,
      label: 'Watch Time',
      value: totalWatchSeconds > 0 ? formatWatchTime(totalWatchSeconds) : '0m',
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/history',
    },
    {
      icon: PlayCircle,
      label: 'In Progress',
      value: unfinishedIds.size,
      color: 'text-accent',
      bg: 'bg-accent/10',
      href: '/history',
    },
    {
      icon: Film,
      label: 'Movies Left',
      value: unwatchedMovies,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      href: '/movies',
    },
    {
      icon: Tv2,
      label: 'Shows Left',
      value: unwatchedShows,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      href: '/shows',
    },
  ];

  if (!history.length && !allMedia.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 mt-4">
      {stats.map(({ icon: Icon, label, value, color, bg, href }) => (
        <Link key={label} to={href} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
          <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className={`font-heading font-bold text-lg leading-none ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}