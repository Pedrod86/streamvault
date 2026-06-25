import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, CheckCircle2, PlayCircle } from 'lucide-react';

export default function HoursWatchedSummary() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 1000),
    staleTime: 5 * 60 * 1000,
  });

  // Total seconds watched = sum of progress across every history entry
  const totalSeconds = history.reduce((acc, h) => acc + (h.progress_seconds || 0), 0);
  const totalHours = totalSeconds / 3600;

  const hoursLabel = totalHours >= 1
    ? totalHours.toFixed(1)
    : (totalSeconds / 60).toFixed(0);
  const unitLabel = totalHours >= 1 ? 'hours watched' : 'minutes watched';

  const completedCount = history.filter(h => h.completed).length;
  const inProgressCount = history.filter(h => !h.completed && (h.progress_seconds || 0) > 0).length;

  return (
    <div className="px-4 sm:px-6 mt-2 mb-6">
      <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Watch Time</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-heading font-bold text-4xl sm:text-5xl text-primary leading-none">
                {isLoading ? '—' : hoursLabel}
              </span>
              <span className="text-sm text-muted-foreground">{unitLabel}</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-7 h-7 text-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-heading font-bold text-lg leading-none text-foreground">{completedCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50">
            <PlayCircle className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="font-heading font-bold text-lg leading-none text-foreground">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">In Progress</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}