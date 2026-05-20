import React, { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

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

    const toastId = toast.loading('Syncing library…', { description: 'Connecting to your servers' });

    try {
      let totalCreated = 0;
      let totalUpdated = 0;
      let clientItems = [];
      const serverErrors = [];

      for (let si = 0; si < syncableServers.length; si++) {
        const server = syncableServers[si];
        const serverLabel = server.server_name || server.server_type;
        setLabel(`Scanning ${serverLabel}…`);
        toast.loading(`Scanning ${serverLabel}…`, { id: toastId });

        const fetchBase = Math.round((si / syncableServers.length) * 50);
        const fetchTop  = Math.round(((si + 1) / syncableServers.length) * 50);

        try {
          const result = await fetchServerLibrary(server, (fetched, total) => {
            if (total > 0) {
              const pct = fetchBase + Math.round((fetched / total) * (fetchTop - fetchBase));
              setProgress(pct);
              setLabel(`Scanning ${serverLabel}… ${fetched} / ${total}`);
            }
          });

          if (Array.isArray(result)) {
            clientItems = clientItems.concat(result);
          }
        } catch (e) {
          console.error(`Sync error for ${serverLabel}:`, e.message);
          serverErrors.push(`${serverLabel}: ${e.message}`);
        }
        setProgress(fetchTop);
      }

      // If ALL servers failed, surface the error
      if (serverErrors.length === syncableServers.length && clientItems.length === 0) {
        throw new Error(serverErrors.join('\n'));
      }

      console.log(`[Sync] fetched ${clientItems.length} items from servers`);

      // Send all fetched items to the backend embySync function which handles
      // proper dedup + bulk create server-side (avoids browser rate limits / timeouts)
      const CHUNK = 500; // send in chunks to avoid request size limits
      const totalChunks = Math.ceil(clientItems.length / CHUNK);
      for (let ci = 0; ci < clientItems.length; ci += CHUNK) {
        const chunk = clientItems.slice(ci, ci + CHUNK);
        const chunkNum = Math.floor(ci / CHUNK) + 1;
        setLabel(`Importing… chunk ${chunkNum} / ${totalChunks}`);
        toast.loading(`Importing… chunk ${chunkNum} / ${totalChunks}`, { id: toastId });

        const res = await base44.functions.invoke('embySync', {
          server: syncableServers[0], // pass first server for logging context
          items: chunk,
        });

        totalCreated += res.data?.created || 0;
        totalUpdated += res.data?.updated || 0;

        if (res.data?.error) {
          console.error(`embySync chunk ${chunkNum} error:`, res.data.error);
        }

        const pct = 50 + Math.round(((ci + chunk.length) / clientItems.length) * 50);
        setProgress(Math.min(pct, 99));
        setLabel(`Importing… ${totalCreated} new, ${totalUpdated} updated`);
        await new Promise(r => setTimeout(r, 200));
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
      const doneMsg = totalCreated > 0
        ? `${totalCreated} new item${totalCreated !== 1 ? 's' : ''} imported`
        : totalUpdated > 0 ? `${totalUpdated} items updated` : 'Library is up to date';
      const partialNote = serverErrors.length > 0 ? ` (${serverErrors.length} server${serverErrors.length > 1 ? 's' : ''} failed)` : '';
      toast.success('Sync complete', { id: toastId, description: doneMsg + partialNote });
      if (serverErrors.length > 0) console.error('Sync partial failures:', serverErrors.join('\n'));
      setTimeout(() => { setStatus('idle'); setProgress(0); }, 5000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Sync failed');
      toast.error('Sync failed', { id: toastId, description: err.message || 'Something went wrong' });
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