import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function SyncProgressBar() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle'); // idle | syncing | done | error
  const [progress, setProgress] = useState(0);   // 0-100
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });

  const syncableServers = servers.filter(s => s.server_type !== 'trakt' && s.is_active !== false);

  const runSync = async () => {
    if (!syncableServers.length) return;
    setStatus('syncing');
    setProgress(0);
    setDismissed(false);
    setErrorMsg('');

    try {
      const existing = await base44.entities.Media.list('-created_date', 2000);
      const existingMap = new Map(existing.map(m => [m.title.toLowerCase().trim(), m]));

      let totalCreated = 0;
      let totalUpdated = 0;
      let clientItems = []; // items from non-Emby servers

      for (let si = 0; si < syncableServers.length; si++) {
        const server = syncableServers[si];
        setLabel(`Fetching from ${server.server_name || server.server_type}…`);
        try {
          const result = await fetchServerLibrary(server);

          if (result?._serverSideSync) {
            // Emby: already synced server-side, just accumulate counts
            totalCreated += result.created || 0;
            totalUpdated += result.updated || 0;
            setLabel(`Emby: ${result.created || 0} new, ${result.fetched || 0} scanned`);
          } else if (Array.isArray(result)) {
            clientItems = clientItems.concat(result);
          }
        } catch (e) {
          console.warn(`Sync skipped server ${server.server_name}: ${e.message}`);
        }
        setProgress(Math.round(((si + 1) / syncableServers.length) * 30));
      }

      // Handle client-side items (Plex, Jellyfin, Xtream)
      const newItems = [];
      const updatePromises = [];
      for (const item of clientItems) {
        const key = item.title?.toLowerCase().trim();
        if (!key) continue;
        const existingItem = existingMap.get(key);
        if (existingItem) {
          if (item.video_url && !existingItem.video_url) {
            updatePromises.push(base44.entities.Media.update(existingItem.id, { video_url: item.video_url }));
          }
        } else {
          newItems.push(item);
        }
      }

      if (updatePromises.length) await Promise.all(updatePromises);
      totalUpdated += updatePromises.length;

      const BATCH = 50;
      for (let i = 0; i < newItems.length; i += BATCH) {
        await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH));
        totalCreated += Math.min(BATCH, newItems.length - i);
        const pct = 30 + Math.round((Math.min(i + BATCH, newItems.length) / Math.max(newItems.length, 1)) * 70);
        setProgress(Math.min(pct, 99));
        setLabel(`Importing… ${Math.min(i + BATCH, newItems.length)} / ${newItems.length}`);
      }

      setProgress(100);
      setLabel(
        totalCreated > 0
          ? `${totalCreated} new item${totalCreated !== 1 ? 's' : ''} imported`
          : totalUpdated > 0
          ? `${totalUpdated} items updated`
          : 'Library is up to date'
      );
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setTimeout(() => { setStatus('idle'); setProgress(0); }, 5000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Sync failed');
    }
  };

  if (dismissed || (status === 'idle' && !syncableServers.length)) return null;

  if (status === 'idle') {
    return (
      <div className="mx-4 sm:mx-6 mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-card border border-border">
        <span className="text-xs text-muted-foreground">
          Sync all {syncableServers.length} server{syncableServers.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={runSync}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync All Libraries
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
        <span className="text-xs text-destructive flex-1 truncate">{errorMsg}</span>
        <button onClick={runSync} className="text-xs text-destructive/80 hover:text-destructive font-medium">Retry</button>
        <button onClick={() => setDismissed(true)}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-xs text-green-400 font-medium flex-1">{label}</span>
        <button onClick={() => setDismissed(true)}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
    );
  }

  // syncing
  return (
    <div className="mx-4 sm:mx-6 mt-4 space-y-2 px-4 py-3 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
          <span className="text-xs text-foreground font-medium">Syncing Library</span>
        </div>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {label && <p className="text-[11px] text-muted-foreground truncate">{label}</p>}
    </div>
  );
}