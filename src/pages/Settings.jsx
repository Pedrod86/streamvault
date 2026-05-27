import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, AlertCircle, Palette, Server, Clock, Save, Trash2, ShieldAlert, Tv2, Radio, Plug, FlaskConical, Zap, LayoutGrid, History, Film, Baby, Sparkles, Clapperboard, MonitorPlay, Download, ArrowUpCircle, PackageCheck, Info, Mail, PlayCircle, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import DeleteAccountDialog from '@/components/layout/DeleteAccountDialog';
import ApiKeysSection from '@/components/settings/ApiKeysSection';
import VideoAudioSection from '@/components/settings/VideoAudioSection';

// Predefined colour themes (primary HSL, accent HSL)
const THEMES = [
  { label: '⚡ Cyberpunk',      primary: '300 100% 55%', accent: '57 100% 50%',  preview: ['#cc00ff', '#ffee00'], cyberpunk: true },
  { label: '🔥 Neon Inferno',   primary: '0 100% 60%',   accent: '30 100% 55%',  preview: ['#ff1a1a', '#ff8800'] },
  { label: '🌊 Neon Ocean',     primary: '195 100% 50%', accent: '240 100% 65%', preview: ['#00d4ff', '#4040ff'] },
  { label: '☢️ Neon Toxic',     primary: '120 100% 50%', accent: '75 100% 50%',  preview: ['#00ff00', '#aaff00'] },
  { label: '🌸 Neon Sakura',    primary: '320 100% 65%', accent: '280 100% 65%', preview: ['#ff40b0', '#c040ff'] },
  { label: '🌅 Neon Sunrise',   primary: '45 100% 55%',  accent: '15 100% 58%',  preview: ['#ffcc00', '#ff5500'] },
];

const INTERVALS = [
  { label: 'Disabled', value: 0 },
  { label: 'Every 15 minutes', value: 15 },
  { label: 'Every 30 minutes', value: 30 },
  { label: 'Every hour', value: 60 },
  { label: 'Every 3 hours', value: 180 },
  { label: 'Every 6 hours', value: 360 },
  { label: 'Every 24 hours', value: 1440 },
];

function applyTheme(primary, accent, cyberpunk = false) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--chart-1', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--chart-2', accent);

  if (cyberpunk) {
    root.classList.add('theme-cyberpunk');
    root.style.setProperty('--background', '270 100% 3%');
    root.style.setProperty('--foreground', '57 100% 55%');
    root.style.setProperty('--card', '270 80% 6%');
    root.style.setProperty('--card-foreground', '57 100% 55%');
    root.style.setProperty('--popover', '270 80% 6%');
    root.style.setProperty('--popover-foreground', '57 100% 55%');
    root.style.setProperty('--secondary', '270 60% 10%');
    root.style.setProperty('--secondary-foreground', '57 100% 65%');
    root.style.setProperty('--muted', '270 60% 10%');
    root.style.setProperty('--muted-foreground', '270 30% 55%');
    root.style.setProperty('--border', '300 80% 30%');
    root.style.setProperty('--input', '270 60% 10%');
    root.style.setProperty('--sidebar-background', '270 80% 6%');
    root.style.setProperty('--sidebar-foreground', '57 100% 55%');
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-border', '300 80% 30%');
    root.style.setProperty('--primary-foreground', '270 100% 5%');
  } else {
    root.classList.remove('theme-cyberpunk');
    root.style.setProperty('--background', '222 47% 6%');
    root.style.setProperty('--foreground', '210 40% 96%');
    root.style.setProperty('--card', '222 41% 9%');
    root.style.setProperty('--card-foreground', '210 40% 96%');
    root.style.setProperty('--popover', '222 41% 9%');
    root.style.setProperty('--popover-foreground', '210 40% 96%');
    root.style.setProperty('--secondary', '222 30% 14%');
    root.style.setProperty('--secondary-foreground', '210 40% 96%');
    root.style.setProperty('--muted', '222 30% 14%');
    root.style.setProperty('--muted-foreground', '215 20% 55%');
    root.style.setProperty('--border', '222 30% 18%');
    root.style.setProperty('--input', '222 30% 18%');
    root.style.setProperty('--sidebar-background', '222 41% 9%');
    root.style.setProperty('--sidebar-foreground', '210 40% 96%');
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-border', '222 30% 18%');
    root.style.setProperty('--primary-foreground', '210 40% 98%');
  }
}

function TvdbEnrichSection() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [enriched, setEnriched] = useState(0);
  const [batches, setBatches] = useState(0);
  const [error, setError] = useState(null);
  const stopRef = useRef(false);

  const run = async () => {
    setStatus('running');
    setEnriched(0);
    setBatches(0);
    setError(null);
    stopRef.current = false;

    let offset = 0;
    let totalEnriched = 0;
    let batchCount = 0;

    try {
      while (!stopRef.current) {
        const res = await base44.functions.invoke('tvdbEnrichLibrary', { offset, batchSize: 50 });
        if (res.data?.error) throw new Error(res.data.error);

        totalEnriched += res.data.enriched || 0;
        batchCount++;
        setEnriched(totalEnriched);
        setBatches(batchCount);

        if (!res.data.hasMore) break;
        offset = res.data.nextOffset;
      }

      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  const stop = () => { stopRef.current = true; };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Tv2 className="w-4 h-4 text-blue-400" />
        <h2 className="font-heading font-semibold text-foreground">TVDB Metadata Enrichment</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Fills in missing posters, descriptions, and genres for your library using TVDB. Runs in small batches — safe to stop and resume.
      </p>

      {status === 'running' && (
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Batch {batches} — {enriched} items enriched so far…
          </p>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{enriched} items enriched across {batches} batches.</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 h-11 border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 gap-2"
          onClick={run}
          disabled={status === 'running'}
        >
          {status === 'running' ? (
            <><RefreshCw className="w-4 h-4 animate-spin" />Enriching…</>
          ) : (
            <><Tv2 className="w-4 h-4" />Enrich Library with TVDB</>
          )}
        </Button>
        {status === 'running' && (
          <Button variant="outline" className="h-11 px-4 border-border text-muted-foreground" onClick={stop}>
            Stop
          </Button>
        )}
      </div>
    </motion.section>
  );
}

function QuickSyncSection() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ fetched: 0, created: 0, updated: 0 });
  const [error, setError] = useState(null);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const { data: importedMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 5000),
    staleTime: 60 * 1000,
  });

  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);

  const run = async () => {
    if (embyServers.length === 0) return;
    setStatus('running');
    setStats({ fetched: 0, created: 0, updated: 0 });
    setError(null);

    let totalFetched = 0, totalCreated = 0, totalUpdated = 0;

    try {
      for (const server of embyServers) {
        let startIndex = 0;
        const PAGE = 200; // smaller pages so we can stop early

        while (true) {
          // Sort by DateCreated descending — newest items arrive first
          const res = await base44.functions.invoke('embyLibrary', {
            startIndex,
            pageSize: PAGE,
            sortBy: 'DateCreated,Descending',
          });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          if (!items?.length) break;

          totalFetched += items.length;
          setStats(s => ({ ...s, fetched: totalFetched }));

          const dbItems = items.map(item => {
            const tags = ['emby', `emby:${item.id}`];
            if (item.is4k) tags.push('4k');
            return {
              emby_id: item.id,
              title: item.title,
              media_type: item.type === 'Series' ? 'tv_show' : 'movie',
              description: item.overview || '',
              year: item.year || undefined,
              rating: item.rating || undefined,
              duration_minutes: item.duration || undefined,
              poster_url: item.posterUrl || undefined,
              backdrop_url: item.backdropUrl || undefined,
              video_url: item.streamUrl || undefined,
              genre: item.genres || [],
              tags,
            };
          });

          const res2 = await base44.functions.invoke('embySync', { server, items: dbItems });
          const pageCreated = res2.data?.created || 0;
          totalCreated += pageCreated;
          totalUpdated += res2.data?.updated || 0;
          setStats({ fetched: totalFetched, created: totalCreated, updated: totalUpdated });

          // Stop early: if this whole page had zero new items, we've caught up
          if (pageCreated === 0) break;
          if (!hasMore) break;
          startIndex += items.length;
        }
      }

      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h2 className="font-heading font-semibold text-foreground">Quick Sync</h2>
        {importedMedia.length > 0 && (
          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
            {importedMedia.length} imported
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Fetches newest Emby items first and stops as soon as it reaches items already in your database. Fast incremental sync — great for picking up recently added content.
      </p>

      {embyServers.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">No active Emby servers found. Add one via <span className="text-primary">Connections</span>.</p>
      )}

      {status === 'running' && (
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full animate-pulse w-full" />
          </div>
          <p className="text-xs text-muted-foreground">
            Fetched {stats.fetched} items… {stats.created} new, {stats.updated} updated
          </p>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{stats.created} new items added, {stats.updated} updated ({stats.fetched} total fetched).</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-11 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500 gap-2"
        onClick={run}
        disabled={status === 'running' || embyServers.length === 0}
      >
        {status === 'running' ? (
          <><RefreshCw className="w-4 h-4 animate-spin" />Syncing…</>
        ) : (
          <><Zap className="w-4 h-4" />Quick Sync Missing Items</>
        )}
      </Button>
    </motion.section>
  );
}

const IS_4K = (item) =>
  item.tags?.some(t => /4k|2160p|uhd/i.test(t)) ||
  item.title?.match(/\b(4K|UHD|2160p)\b/i);

const IS_KIDS = (item) =>
  item.genre?.some(g => /kids?|children|family/i.test(g)) ||
  ['TV-Y', 'TV-G', 'G', 'TV-Y7'].includes(item.content_rating);

const IS_ANIME = (item) =>
  item.genre?.some(g => /^anime$/i.test(g)) ||
  item.tags?.some(t => /^anime$/.test(t));

const CATEGORIES = [
  { id: 'movies',    label: 'Emby Movies',    icon: Film,        color: 'blue',   filter: (i) => i.type === 'Movie' && !IS_4K(i) },
  { id: 'tv',        label: 'Emby TV Shows',  icon: Tv2,         color: 'purple', filter: (i) => i.type === 'Series' && !IS_4K(i) },
  { id: '4k-movies', label: 'Emby 4K Movies', icon: Clapperboard, color: 'yellow', filter: (i) => i.type === 'Movie' && IS_4K(i) },
  { id: '4k-tv',     label: 'Emby 4K TV',     icon: MonitorPlay, color: 'orange', filter: (i) => i.type === 'Series' && IS_4K(i) },
  { id: 'kids',      label: 'Emby Kids TV',   icon: Baby,        color: 'pink',   filter: (i) => IS_KIDS(i) },
  { id: 'anime',     label: 'Emby Anime',     icon: Sparkles,    color: 'rose',   filter: (i) => IS_ANIME(i) },
];

const COLOR_CLASSES = {
  blue:   { border: 'border-blue-500/40',   text: 'text-blue-400',   hover: 'hover:bg-blue-500/10 hover:border-blue-500',   bg: 'bg-blue-500',   badge: 'bg-blue-500/10 text-blue-400' },
  purple: { border: 'border-purple-500/40', text: 'text-purple-400', hover: 'hover:bg-purple-500/10 hover:border-purple-500', bg: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-400' },
  yellow: { border: 'border-yellow-500/40', text: 'text-yellow-400', hover: 'hover:bg-yellow-500/10 hover:border-yellow-500', bg: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-400' },
  orange: { border: 'border-orange-500/40', text: 'text-orange-400', hover: 'hover:bg-orange-500/10 hover:border-orange-500', bg: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400' },
  pink:   { border: 'border-pink-500/40',   text: 'text-pink-400',   hover: 'hover:bg-pink-500/10 hover:border-pink-500',   bg: 'bg-pink-500',   badge: 'bg-pink-500/10 text-pink-400' },
  rose:   { border: 'border-rose-500/40',   text: 'text-rose-400',   hover: 'hover:bg-rose-500/10 hover:border-rose-500',   bg: 'bg-rose-500',   badge: 'bg-rose-500/10 text-rose-400' },
};

function CategorySyncSection() {
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState({});
  const [stats, setStats] = useState({});
  const [errors, setErrors] = useState({});

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 5000),
    staleTime: 60 * 1000,
  });

  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);

  const runCategory = async (cat) => {
    if (embyServers.length === 0) return;
    setStatuses(s => ({ ...s, [cat.id]: 'running' }));
    setStats(s => ({ ...s, [cat.id]: { fetched: 0, created: 0, updated: 0 } }));
    setErrors(e => ({ ...e, [cat.id]: null }));

    try {
      for (const server of embyServers) {
        let startIndex = 0;
        const PAGE = 500;
        let totalFiltered = 0, totalCreated = 0, totalUpdated = 0;

        while (true) {
          const res = await base44.functions.invoke('embyLibrary', { startIndex, pageSize: PAGE });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          if (!items?.length) break;

          // Filter to this category
          const filtered = items.filter(cat.filter);
          totalFiltered += filtered.length;

          if (filtered.length > 0) {
            const dbItems = filtered.map(item => {
              const tags = ['emby', `emby:${item.id}`];
              if (item.is4k) tags.push('4k');
              return {
                emby_id: item.id,
                title: item.title,
                media_type: item.type === 'Series' ? 'tv_show' : 'movie',
                description: item.overview || '',
                year: item.year || undefined,
                rating: item.rating || undefined,
                duration_minutes: item.duration || undefined,
                poster_url: item.posterUrl || undefined,
                backdrop_url: item.backdropUrl || undefined,
                video_url: item.streamUrl || undefined,
                genre: item.genres || [],
                tags,
              };
            });

            const res2 = await base44.functions.invoke('embySync', { server, items: dbItems });
            totalCreated += res2.data?.created || 0;
            totalUpdated += res2.data?.updated || 0;
            setStats(s => ({ ...s, [cat.id]: { fetched: totalFiltered, created: totalCreated, updated: totalUpdated } }));
          }

          if (!hasMore) break;
          startIndex += items.length;
        }
      }

      setStatuses(s => ({ ...s, [cat.id]: 'done' }));
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setErrors(err => ({ ...err, [cat.id]: e.message }));
      setStatuses(s => ({ ...s, [cat.id]: 'error' }));
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="w-4 h-4 text-accent" />
        <h2 className="font-heading font-semibold text-foreground">Quick Sync by Category</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Sync individual categories from your Emby library into the database.
      </p>

      {embyServers.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">No active Emby servers found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATEGORIES.map(cat => {
          const st = statuses[cat.id] || 'idle';
          const s = stats[cat.id];
          const err = errors[cat.id];
          const c = COLOR_CLASSES[cat.color];
          const Icon = cat.icon;

          // Map DB media to the same shape the filter expects
          const dbMapped = allMedia.map(m => ({
            type: m.media_type === 'tv_show' ? 'Series' : 'Movie',
            tags: m.tags || [],
            genre: m.genre || [],
            content_rating: m.content_rating,
            title: m.title,
          }));
          const importedCount = dbMapped.filter(cat.filter).length;

          return (
            <div key={cat.id} className={`p-3 rounded-xl border ${c.border} bg-secondary/30 space-y-2`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${c.text} shrink-0`} />
                <span className="text-sm font-medium text-foreground">{cat.label}</span>
                <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{importedCount}</span>
              </div>

              {st === 'running' && (
                <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full ${c.bg} rounded-full animate-pulse w-full`} />
                </div>
              )}
              {st === 'done' && s && (
                <p className="text-[11px] text-green-400">{s.created} added, {s.updated} updated ({s.fetched} fetched)</p>
              )}
              {st === 'error' && err && (
                <p className="text-[11px] text-destructive truncate">{err}</p>
              )}

              <Button
                size="sm"
                variant="outline"
                className={`w-full h-8 text-xs border ${c.border} ${c.text} ${c.hover} gap-1.5`}
                onClick={() => runCategory(cat)}
                disabled={st === 'running' || embyServers.length === 0}
              >
                <RefreshCw className={`w-3 h-3 ${st === 'running' ? 'animate-spin' : ''}`} />
                {st === 'running' ? 'Syncing…' : 'Sync'}
              </Button>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

function DeduplicateSection() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setStatus('running');
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('embyDeduplicate', {});
      if (res.data?.error) throw new Error(res.data.error);
      setResult(res.data);
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.125 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 className="w-4 h-4 text-orange-400" />
        <h2 className="font-heading font-semibold text-foreground">Remove Duplicates</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Scans your library and removes duplicate entries — keeps one copy per Emby item ID, or per title+type as a fallback.
      </p>

      {status === 'running' && (
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full animate-pulse w-full" />
        </div>
      )}
      {status === 'done' && result && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Removed {result.duplicates_deleted} duplicates from {result.total_scanned} items.</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-11 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500 gap-2"
        onClick={run}
        disabled={status === 'running'}
      >
        {status === 'running' ? (
          <><RefreshCw className="w-4 h-4 animate-spin" />Scanning for duplicates…</>
        ) : (
          <><Trash2 className="w-4 h-4" />Remove Duplicates</>
        )}
      </Button>
    </motion.section>
  );
}

function ExportLibrarySection() {
  const [status, setStatus] = useState('idle');

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 5000),
    staleTime: 5 * 60 * 1000,
  });

  const exportJson = () => {
    setStatus('exporting');
    const json = JSON.stringify(allMedia, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamvault-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('done');
    setTimeout(() => setStatus('idle'), 3000);
  };

  const exportCsv = () => {
    setStatus('exporting');
    const headers = ['title', 'media_type', 'year', 'rating', 'genre', 'director', 'studio', 'content_rating', 'season_count', 'episode_count', 'description'];
    const rows = allMedia.map(m =>
      headers.map(h => {
        const val = m[h];
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val ?? '';
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamvault-library-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('done');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-4 h-4 text-accent" />
        <h2 className="font-heading font-semibold text-foreground">Export Library</h2>
        <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
          {allMedia.length} items
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Download your entire media library as JSON or CSV.
      </p>
      {status === 'done' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Export downloaded successfully.
        </div>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-10 border-accent/40 text-accent hover:bg-accent/10 hover:border-accent gap-2"
          onClick={exportJson}
          disabled={status === 'exporting' || allMedia.length === 0}
        >
          <Download className="w-4 h-4" /> Export JSON
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-10 border-accent/40 text-accent hover:bg-accent/10 hover:border-accent gap-2"
          onClick={exportCsv}
          disabled={status === 'exporting' || allMedia.length === 0}
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>
    </motion.section>
  );
}

const CURRENT_VERSION = '1.0.0';

function CheckForUpdatesSection() {
  const [status, setStatus] = useState('idle'); // idle | checking | uptodate | update-available | error
  const [latestVersion, setLatestVersion] = useState(null);
  const [releaseUrl, setReleaseUrl] = useState(null);
  const [releaseNotes, setReleaseNotes] = useState(null);

  const check = async () => {
    setStatus('checking');
    setLatestVersion(null);
    setReleaseUrl(null);
    setReleaseNotes(null);
    try {
      const res = await base44.functions.invoke('githubLatestRelease', {});
      const data = res.data;
      if (data?.error) throw new Error(data.error);
      const tag = (data.tag || '').replace(/^v/, '');
      setLatestVersion(tag);
      setReleaseUrl(data.html_url || null);
      setReleaseNotes(data.body ? data.body.slice(0, 300) : null);
      setStatus(tag && tag !== CURRENT_VERSION ? 'update-available' : 'uptodate');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.145 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-1">
        <PackageCheck className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-foreground">App Updates</h2>
        <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">v{CURRENT_VERSION}</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Check if a newer version of StreamVault is available.</p>

      {status === 'uptodate' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>You're on the latest version (v{latestVersion}).</span>
        </div>
      )}

      {status === 'update-available' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">
            <ArrowUpCircle className="w-4 h-4 shrink-0" />
            <span>Update available: <strong>v{latestVersion}</strong></span>
          </div>
          {releaseNotes && (
            <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 line-clamp-3">{releaseNotes}</p>
          )}
          {releaseUrl && (
            <a href={releaseUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2">
              <ArrowUpCircle className="w-3 h-3" /> View release on GitHub
            </a>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Couldn't reach GitHub. Check your connection and try again.</span>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-10 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary gap-2"
        onClick={check}
        disabled={status === 'checking'}
      >
        {status === 'checking' ? (
          <><RefreshCw className="w-4 h-4 animate-spin" />Checking…</>
        ) : (
          <><PackageCheck className="w-4 h-4" />Check for Updates</>
        )}
      </Button>
    </motion.section>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settingsList = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const settings = settingsList[0] || null;

  const [selectedTheme, setSelectedTheme] = useState(0);
  const [syncInterval, setSyncInterval] = useState('0');
  const [savedTheme, setSavedTheme] = useState(false);
  const [savedSync, setSavedSync] = useState(false);

  // Server sync states
  const [serverStatuses, setServerStatuses] = useState({});

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  // Load existing settings and re-apply theme
  useEffect(() => {
    if (!settings) return;
    const themeIdx = THEMES.findIndex(t => t.primary === settings.accent_color);
    if (themeIdx >= 0) {
      setSelectedTheme(themeIdx);
      const t = THEMES[themeIdx];
      applyTheme(t.primary, t.accent, !!t.cyberpunk);
    }
    setSyncInterval(String(settings.sync_interval_minutes ?? 0));
  }, [settings]);

  // Apply theme on selection change
  useEffect(() => {
    const t = THEMES[selectedTheme];
    applyTheme(t.primary, t.accent, !!t.cyberpunk);
  }, [selectedTheme]);

  const saveSettings = async (patch, onDone) => {
    const existing = settingsList[0];
    if (existing?.id) {
      await base44.entities.AppSettings.update(existing.id, patch);
    } else {
      await base44.entities.AppSettings.create(patch);
    }
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    onDone();
  };

  const saveThemeMutation = useMutation({
    mutationFn: () => {
      const t = THEMES[selectedTheme];
      return saveSettings({ accent_color: t.primary, secondary_color: t.accent }, () => {
        setSavedTheme(true);
        setTimeout(() => setSavedTheme(false), 2500);
      });
    },
  });

  const saveSyncMutation = useMutation({
    mutationFn: () => saveSettings({ sync_interval_minutes: parseInt(syncInterval, 10) }, () => {
      setSavedSync(true);
      setTimeout(() => setSavedSync(false), 2500);
    }),
  });

  const runSync = async (server) => {
    setServerStatuses(s => ({ ...s, [server.id]: 'syncing' }));
    try {
      if (server.server_type === 'emby') {
        let startIndex = 0;
        const PAGE = 500;
        while (true) {
          const res = await base44.functions.invoke('embyLibrary', { startIndex, pageSize: PAGE });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          if (!items?.length) break;
          const dbItems = items.map(item => {
            const tags = ['emby', `emby:${item.id}`];
            if (item.is4k) tags.push('4k');
            return {
              emby_id: item.id,
              title: item.title,
              media_type: item.type === 'Series' ? 'tv_show' : 'movie',
              description: item.overview || '',
              year: item.year || undefined,
              rating: item.rating || undefined,
              duration_minutes: item.duration || undefined,
              poster_url: item.posterUrl || undefined,
              backdrop_url: item.backdropUrl || undefined,
              video_url: item.streamUrl || undefined,
              genre: item.genres || [],
              tags,
            };
          });
          await base44.functions.invoke('embySync', { server, items: dbItems });
          if (!hasMore) break;
          startIndex += items.length;
        }
      } else {
        // Other server types (Plex, Jellyfin, Xtream) use the client-side fetch
        const items = await fetchServerLibrary(server);
        if (items.length > 0) {
          await base44.functions.invoke('embySync', { server, items });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setServerStatuses(s => ({ ...s, [server.id]: 'done' }));
      setTimeout(() => setServerStatuses(s => ({ ...s, [server.id]: 'idle' })), 3000);
    } catch (e) {
      setServerStatuses(s => ({ ...s, [server.id]: 'error' }));
      setTimeout(() => setServerStatuses(s => ({ ...s, [server.id]: 'idle' })), 4000);
    }
  };

  const mediaServers = servers.filter(s => s.server_type !== 'trakt');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Customise your StreamVault experience</p>
      </div>

      {/* ── Appearance ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Appearance</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Choose an accent colour theme for the UI.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THEMES.map((theme, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedTheme(idx)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                selectedTheme === idx
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-border/80 hover:bg-secondary/50'
              }`}
            >
              <div className="flex gap-1 shrink-0">
                <span className="w-4 h-4 rounded-full" style={{ background: theme.preview[0] }} />
                <span className="w-4 h-4 rounded-full" style={{ background: theme.preview[1] }} />
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">{theme.label}</span>
              {selectedTheme === idx && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
            </button>
          ))}
        </div>
        <Button
          className="w-full h-10 rounded-xl font-semibold bg-primary hover:bg-primary/90 gap-2 mt-1"
          onClick={() => saveThemeMutation.mutate()}
          disabled={saveThemeMutation.isPending}
        >
          {savedTheme ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />{saveThemeMutation.isPending ? 'Saving…' : 'Save Theme'}</>}
        </Button>
      </motion.section>

      {/* ── Video & Audio ── */}
      <VideoAudioSection />

      {/* ── Server Auto-Sync ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Auto-Sync Interval</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Automatically sync all media servers in the background.</p>

        <div>
          <Label className="text-sm text-foreground">Sync every</Label>
          <Select value={syncInterval} onValueChange={setSyncInterval}>
            <SelectTrigger className="mt-1 bg-secondary border-border h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {INTERVALS.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {syncInterval !== '0' && (
            <p className="text-xs text-primary mt-1.5">
              ✓ All media servers will sync every {INTERVALS.find(i => i.value === parseInt(syncInterval))?.label.toLowerCase().replace('every ', '')}
            </p>
          )}
        </div>
        <Button
          className="w-full h-10 rounded-xl font-semibold bg-primary hover:bg-primary/90 gap-2"
          onClick={() => saveSyncMutation.mutate()}
          disabled={saveSyncMutation.isPending}
        >
          {savedSync ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />{saveSyncMutation.isPending ? 'Saving…' : 'Save Interval'}</>}
        </Button>
      </motion.section>

      {/* ── Manual Server Sync ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4 p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Force Sync Servers</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Manually trigger a full library sync for each connected server.</p>

        {mediaServers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No media servers connected. Go to <span className="text-primary">Connections</span> to add one.</p>
        ) : (
          <div className="space-y-3">
            {mediaServers.map(server => {
              const st = serverStatuses[server.id] || 'idle';
              const typeLabels = { plex: 'Plex', emby: 'Emby', jellyfin: 'Jellyfin' };
              return (
                <div key={server.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{server.server_name || typeLabels[server.server_type] || server.server_type}</p>
                    <p className="text-xs text-muted-foreground truncate">{server.server_url || 'No URL'}</p>
                  </div>
                  <div className="shrink-0">
                    {st === 'done' && (
                      <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" />Done</span>
                    )}
                    {st === 'error' && (
                      <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3.5 h-3.5" />Failed</span>
                    )}
                    {(st === 'idle' || st === 'syncing') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border h-8 px-3 gap-1.5 text-xs"
                        disabled={st === 'syncing'}
                        onClick={() => runSync(server)}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${st === 'syncing' ? 'animate-spin' : ''}`} />
                        {st === 'syncing' ? 'Syncing…' : 'Sync Now'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ── Quick Sync ── */}
      <QuickSyncSection />

      {/* ── Category Sync ── */}
      <CategorySyncSection />

      {/* ── TVDB Bulk Enrich ── */}
      <TvdbEnrichSection />

      {/* ── Deduplicate Library ── */}
      <DeduplicateSection />

      {/* ── Export Library ── */}
      <ExportLibrarySection />

      {/* ── API Keys ── */}
      <ApiKeysSection />

      {/* ── Check for Updates ── */}
      <CheckForUpdatesSection />

      {/* ── Quick Links ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="space-y-3 p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Tools & Connections</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Quick access to advanced tools and server management.</p>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/free-streams" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <Zap className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Free Streams</p>
              <p className="text-[11px] text-muted-foreground">Browse free content</p>
            </div>
          </Link>
          <Link to="/tv-guide" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <LayoutGrid className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">TV Guide</p>
              <p className="text-[11px] text-muted-foreground">Live TV schedule</p>
            </div>
          </Link>
          <Link to="/stream-tester" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <FlaskConical className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Stream Tester</p>
              <p className="text-[11px] text-muted-foreground">Test any stream URL</p>
            </div>
          </Link>
          <Link to="/connect-server" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <Plug className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Connections</p>
              <p className="text-[11px] text-muted-foreground">Add / manage servers</p>
            </div>
          </Link>
          <Link to="/sync-status" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <RefreshCw className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Sync Status</p>
              <p className="text-[11px] text-muted-foreground">View sync logs</p>
            </div>
          </Link>
          <Link to="/history" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <History className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Watch History</p>
              <p className="text-[11px] text-muted-foreground">Your viewing history</p>
            </div>
          </Link>
          <Link to="/about" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <Info className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">About StreamVault</p>
              <p className="text-[11px] text-muted-foreground">Features & privacy info</p>
            </div>
          </Link>
          <Link to="/contact" className="flex items-center gap-3 p-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
            <Mail className="w-5 h-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Contact Us</p>
              <p className="text-[11px] text-muted-foreground">Get in touch with support</p>
            </div>
          </Link>
        </div>
      </motion.section>

      {/* ── Account Management ── */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4 p-5 rounded-xl bg-card border border-destructive/30 pb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <h2 className="font-heading font-semibold text-foreground">Account Management</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Permanently remove your account and all associated data including watchlist, history, and server connections.
        </p>
        <Button
          variant="outline"
          className="w-full h-11 border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive gap-2"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          Delete My Account
        </Button>
      </motion.section>

      <DeleteAccountDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </div>
  );
}