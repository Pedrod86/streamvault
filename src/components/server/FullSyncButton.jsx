import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Forces a FULL library sync — fetches the server's entire catalogue and
 * upserts it through embySync (which deduplicates against existing records).
 * Unlike Quick Sync (recently-added only), this reconciles the whole library.
 */
export default function FullSyncButton({ server }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle'); // idle | syncing | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  const syncMutation = useMutation({
    mutationFn: async () => {
      setStatus('syncing');
      setErrorMsg('');
      setProgress({ done: 0, total: 0 });

      let items;
      try {
        items = await fetchServerLibrary(server, (done, total) => setProgress({ done, total }));
      } catch (err) {
        throw new Error(err.message || 'Full sync failed. Check your server credentials and URL.');
      }

      if (!items.length) return 0;

      const BATCH = 200;
      for (let i = 0; i < items.length; i += BATCH) {
        await base44.functions.invoke('embySync', { server, items: items.slice(i, i + BATCH) });
      }
      return items.length;
    },
    onSuccess: (total) => {
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setProgress({ done: total, total });
      setTimeout(() => setStatus('idle'), 4000);
    },
    onError: (err) => {
      setStatus('error');
      setErrorMsg(err.message || 'Could not reach server. Check the URL and token.');
      setTimeout(() => setStatus('idle'), 6000);
    },
  });

  if (status === 'done') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {progress.total > 0 ? `${progress.total} items synced` : 'Already up to date'}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium max-w-[280px]">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />
        <span className="text-destructive/80 leading-snug truncate">{errorMsg}</span>
        <button className="ml-auto text-muted-foreground hover:text-foreground shrink-0" onClick={() => syncMutation.mutate()}>
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const label = status === 'syncing'
    ? (progress.total > 0 ? `Syncing… ${progress.done}/${progress.total}` : 'Syncing…')
    : 'Full Sync';

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border rounded-lg gap-1.5 text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
      onClick={() => syncMutation.mutate()}
      disabled={status === 'syncing'}
    >
      <RotateCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {label}
    </Button>
  );
}