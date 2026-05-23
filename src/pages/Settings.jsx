import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, AlertCircle, Palette, Server, Clock, Save, Trash2, ShieldAlert, Tv2, Radio, Plug, FlaskConical, Zap, LayoutGrid, History, Film, Baby, Sparkles, Clapperboard, MonitorPlay } from 'lucide-react';
import { motion } from 'framer-motion';
import DeleteAccountDialog from '@/components/layout/DeleteAccountDialog';

// Predefined colour themes (primary HSL, accent HSL)
const THEMES = [
  { label: 'Purple & Cyan',  primary: '262 83% 58%', accent: '199 89% 48%', preview: ['#7c3aed', '#06b6d4'] },
  { label: 'Red & Orange',   primary: '0 84% 55%',   accent: '25 95% 53%',  preview: ['#ef4444', '#f97316'] },
  { label: 'Blue & Indigo',  primary: '221 83% 53%', accent: '239 84% 67%', preview: ['#3b82f6', '#6366f1'] },
  { label: 'Green & Teal',   primary: '142 71% 45%', accent: '173 80% 40%', preview: ['#22c55e', '#14b8a6'] },
  { label: 'Pink & Rose',    primary: '330 81% 60%', accent: '346 77% 49%', preview: ['#ec4899', '#f43f5e'] },
  { label: 'Amber & Yellow', primary: '38 92% 50%',  accent: '48 96% 53%',  preview: ['#f59e0b', '#eab308'] },
  { label: 'Slate (Neutral)',primary: '215 25% 50%', accent: '215 20% 65%', preview: ['#64748b', '#94a3b8'] },
  { label: '⚡ Cyberpunk',   primary: '300 100% 55%', accent: '57 100% 50%', preview: ['#cc00ff', '#ffee00'], cyberpunk: true },
  { label: '📺 Sky UK',      primary: '349 100% 46%', accent: '210 100% 56%', preview: ['#e8002d', '#1a8fe8'] },
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
        // Fetch all items from Emby via the existing embyLibrary function (paginated)
        let startIndex = 0;
        let allItems = [];
        while (true) {
          const res = await base44.functions.invoke('embyLibrary', { startIndex, serverId: server.id });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          if (items?.length) allItems = [...allItems, ...items];
          if (!hasMore || !items?.length) break;
          startIndex += items.length;
        }

        totalFetched += allItems.length;
        setStats(s => ({ ...s, fetched: totalFetched }));

        if (allItems.length > 0) {
          // Map to DB format
          const dbItems = allItems.map(item => ({
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
            tags: ['emby'],
          }));

          const res2 = await base44.functions.invoke('embySync', { server, items: dbItems });
          totalCreated += res2.data?.created || 0;
          totalUpdated += res2.data?.updated || 0;
          setStats({ fetched: totalFetched, created: totalCreated, updated: totalUpdated });
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
        Fetches your Emby library and adds only missing items to your database. Fast and non-destructive.
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
        // Fetch full library
        let startIndex = 0;
        let allItems = [];
        while (true) {
          const res = await base44.functions.invoke('embyLibrary', { startIndex, serverId: server.id });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          if (items?.length) allItems = [...allItems, ...items];
          if (!hasMore || !items?.length) break;
          startIndex += items.length;
        }

        // Filter to this category
        const filtered = allItems.filter(cat.filter);
        setStats(s => ({ ...s, [cat.id]: { ...s[cat.id], fetched: filtered.length } }));

        if (filtered.length > 0) {
          const dbItems = filtered.map(item => ({
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
            tags: ['emby'],
          }));

          const res2 = await base44.functions.invoke('embySync', { server, items: dbItems });
          setStats(s => ({ ...s, [cat.id]: {
            fetched: filtered.length,
            created: res2.data?.created || 0,
            updated: res2.data?.updated || 0,
          }}));
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
      const items = await fetchServerLibrary(server);
      if (items.length > 0) {
        const existing = await base44.entities.Media.list('-created_date', 500);
        const existingMap = new Map(existing.map(m => [m.title.toLowerCase().trim(), m]));
        const newItems = items.filter(item => !existingMap.has(item.title.toLowerCase().trim()));
        const BATCH = 50;
        for (let i = 0; i < newItems.length; i += BATCH) {
          await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH));
        }
        queryClient.invalidateQueries({ queryKey: ['media'] });
      }
      setServerStatuses(s => ({ ...s, [server.id]: 'done' }));
      setTimeout(() => setServerStatuses(s => ({ ...s, [server.id]: 'idle' })), 3000);
    } catch {
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