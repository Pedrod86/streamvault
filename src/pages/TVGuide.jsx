import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tv, Clock, ChevronRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

// Deterministically spread media items across a fake schedule grid
// so users can see "now airing" and "coming up next" per channel/category.
function buildSchedule(channels, nowMs) {
  // Each slot is 90 minutes
  const SLOT = 90 * 60 * 1000;
  // Snap now to the nearest slot start
  const slotStart = Math.floor(nowMs / SLOT) * SLOT;

  return channels.map((channel, ci) => {
    // Use channel index as a stable seed to pick items
    const seed = ci * 3;
    const slots = [];
    for (let i = -1; i <= 3; i++) {
      const idx = ((seed + i) % channel.items.length + channel.items.length) % channel.items.length;
      slots.push({
        item: channel.items[idx],
        startMs: slotStart + i * SLOT,
        endMs: slotStart + (i + 1) * SLOT,
      });
    }
    return { ...channel, slots };
  });
}

function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function progressPct(startMs, endMs, nowMs) {
  const total = endMs - startMs;
  const elapsed = nowMs - startMs;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export default function TVGuide() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const nowMs = Date.now();

  const { data: allMedia = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Only use IPTV/Xtream content (has 'iptv' or 'xtream' tag, or has a video_url)
  const iptvMedia = useMemo(
    () => allMedia.filter(m => m.tags?.includes('iptv') || m.tags?.includes('xtream') || m.video_url),
    [allMedia]
  );

  // Group by genre/category
  const categoryMap = useMemo(() => {
    const map = {};
    iptvMedia.forEach(m => {
      const cats = m.genre?.length ? m.genre : ['Uncategorized'];
      cats.forEach(cat => {
        if (!map[cat]) map[cat] = [];
        map[cat].push(m);
      });
    });
    return map;
  }, [iptvMedia]);

  const categories = useMemo(() => ['All', ...Object.keys(categoryMap).sort()], [categoryMap]);

  // Build channel rows — one per category (or all merged under "All")
  const channels = useMemo(() => {
    if (selectedCategory === 'All') {
      // One row per category, capped at 20
      return Object.entries(categoryMap)
        .filter(([, items]) => items.length > 0)
        .slice(0, 20)
        .map(([cat, items]) => ({ id: cat, name: cat, items }));
    }
    const items = categoryMap[selectedCategory] || [];
    if (!items.length) return [];
    // Split into sub-channels of ~8 items each, labelled CH1, CH2…
    const SIZE = 8;
    const rows = [];
    for (let i = 0; i < Math.min(items.length, 40); i += SIZE) {
      rows.push({
        id: `${selectedCategory}-${i}`,
        name: `${selectedCategory} ${rows.length + 1}`,
        items: items.slice(i, i + SIZE),
      });
    }
    return rows;
  }, [selectedCategory, categoryMap]);

  const schedule = useMemo(() => buildSchedule(channels, nowMs), [channels, nowMs]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (iptvMedia.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Tv className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="font-heading font-bold text-xl text-foreground">No IPTV Channels</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Connect an Xtream Codes IPTV server to see your TV guide here.
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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Tv className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">TV Guide</h1>
          <p className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> {new Date(nowMs).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Time header */}
      <div className="hidden sm:grid grid-cols-[180px_1fr_1fr_1fr] gap-2 mb-2 px-1">
        <div />
        {[-1, 0, 1].map(offset => {
          const SLOT = 90 * 60 * 1000;
          const slotStart = Math.floor(nowMs / SLOT) * SLOT;
          const t = slotStart + offset * SLOT;
          return (
            <div key={offset} className="text-xs text-muted-foreground font-medium">
              {fmtTime(t)} – {fmtTime(t + SLOT)}
              {offset === 0 && <span className="ml-2 text-primary font-semibold">NOW</span>}
            </div>
          );
        })}
      </div>

      {/* Channel rows */}
      <div className="space-y-2">
        {schedule.map(channel => {
          const currentSlot = channel.slots.find(s => s.startMs <= nowMs && s.endMs > nowMs);
          const nextSlot = channel.slots.find(s => s.startMs > nowMs);
          const pct = currentSlot ? progressPct(currentSlot.startMs, currentSlot.endMs, nowMs) : 0;

          return (
            <div key={channel.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Mobile layout */}
              <div className="sm:hidden p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-heading font-semibold text-sm text-foreground line-clamp-1">{channel.name}</span>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary shrink-0">LIVE</Badge>
                </div>
                {currentSlot && (
                  <>
                    <p className="text-sm font-medium text-foreground line-clamp-1">{currentSlot.item.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                    </div>
                  </>
                )}
                {nextSlot && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    Next: <span className="text-foreground/70">{nextSlot.item.title}</span>
                    <span className="ml-auto">{fmtTime(nextSlot.startMs)}</span>
                  </p>
                )}
              </div>

              {/* Desktop grid layout */}
              <div className="hidden sm:grid grid-cols-[180px_1fr_1fr_1fr] gap-0 divide-x divide-border">
                {/* Channel name */}
                <div className="flex items-center gap-2 px-3 py-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Tv className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">{channel.name}</span>
                </div>

                {/* Past slot */}
                {channel.slots[0] && (
                  <div className="px-3 py-3 opacity-40">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{fmtTime(channel.slots[0].startMs)}</p>
                    <p className="text-xs text-foreground line-clamp-2">{channel.slots[0].item.title}</p>
                  </div>
                )}

                {/* Current slot */}
                {currentSlot ? (
                  <div className="px-3 py-3 bg-primary/5 relative">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-primary uppercase">Now</span>
                      <span className="text-[10px] text-muted-foreground">{fmtTime(currentSlot.startMs)}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground line-clamp-2">{currentSlot.item.title}</p>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : <div className="px-3 py-3" />}

                {/* Next slot */}
                {nextSlot ? (
                  <div className="px-3 py-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{fmtTime(nextSlot.startMs)}</p>
                    <p className="text-xs text-foreground line-clamp-2">{nextSlot.item.title}</p>
                  </div>
                ) : <div className="px-3 py-3" />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Schedule is simulated based on your IPTV library. Times reset on page refresh.
      </p>
    </div>
  );
}