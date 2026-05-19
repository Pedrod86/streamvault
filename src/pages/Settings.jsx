import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, CheckCircle2, AlertCircle, Palette, Server, Clock, Save, Trash2, ShieldAlert } from 'lucide-react';
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

function applyTheme(primary, accent) {
  document.documentElement.style.setProperty('--primary', primary);
  document.documentElement.style.setProperty('--ring', primary);
  document.documentElement.style.setProperty('--chart-1', primary);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--chart-2', accent);
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
  const [saved, setSaved] = useState(false);

  // Server sync states
  const [serverStatuses, setServerStatuses] = useState({});

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  // Load existing settings
  useEffect(() => {
    if (!settings) return;
    const themeIdx = THEMES.findIndex(t => t.primary === settings.accent_color);
    if (themeIdx >= 0) setSelectedTheme(themeIdx);
    setSyncInterval(String(settings.sync_interval_minutes ?? 0));
  }, [settings]);

  // Apply theme on selection change
  useEffect(() => {
    const t = THEMES[selectedTheme];
    applyTheme(t.primary, t.accent);
  }, [selectedTheme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const t = THEMES[selectedTheme];
      const payload = {
        accent_color: t.primary,
        secondary_color: t.accent,
        sync_interval_minutes: parseInt(syncInterval, 10),
      };
      if (settings?.id) {
        return base44.entities.AppSettings.update(settings.id, payload);
      } else {
        return base44.entities.AppSettings.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
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
              {/* Colour swatches */}
              <div className="flex gap-1 shrink-0">
                <span className="w-4 h-4 rounded-full" style={{ background: theme.preview[0] }} />
                <span className="w-4 h-4 rounded-full" style={{ background: theme.preview[1] }} />
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">{theme.label}</span>
              {selectedTheme === idx && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
            </button>
          ))}
        </div>
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

      {/* ── Save ── */}
      <div>
        <Button
          className="w-full h-11 rounded-xl font-semibold bg-primary hover:bg-primary/90 gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? (
            <><CheckCircle2 className="w-4 h-4" />Saved!</>
          ) : (
            <><Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving…' : 'Save Settings'}</>
          )}
        </Button>
      </div>

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