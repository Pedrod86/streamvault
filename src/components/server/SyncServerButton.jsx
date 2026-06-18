import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchRecentlyAdded } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SyncServerButton({ server }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle'); // idle | syncing | done | error
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const syncMutation = useMutation({
    mutationFn: async () => {
      setStatus('syncing');
      setErrorMsg('');

      // Quick sync — fetches only recently added items (fast)
      let items;
      try {
        items = await fetchRecentlyAdded(server);
      } catch (err) {
        throw new Error(err.message || 'Sync failed. Check your server credentials and URL.');
      }

      if (!items.length) return 0;

      // Deduplicate against existing titles
      const existing = await base44.entities.Media.list('-created_date', 500);
      const existingTitles = new Set(existing.map(m => m.title?.toLowerCase().trim()));
      const newItems = items.filter(i => i.title && !existingTitles.has(i.title.toLowerCase().trim()));

      if (!newItems.length) return 0;

      const BATCH = 50;
      let created = 0;
      for (let i = 0; i < newItems.length; i += BATCH) {
        await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH));
        created += Math.min(BATCH, newItems.length - i);
        setCount(created);
      }
      return created;
    },
    onSuccess: (created) => {
      setCount(created);
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
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
        {count > 0 ? `${count} items imported` : count < 0 ? `${Math.abs(count)} items updated` : 'Already up to date'}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium max-w-[280px]">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-destructive" />
        <span className="text-destructive/80 leading-snug truncate">{errorMsg}</span>
        <button className="ml-auto text-muted-foreground hover:text-foreground shrink-0" onClick={() => syncMutation.mutate()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border rounded-lg gap-1.5 text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
      onClick={() => syncMutation.mutate()}
      disabled={status === 'syncing'}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {status === 'syncing' ? (count > 0 ? `Syncing… ${count} added` : 'Syncing…') : 'Quick Sync'}
    </Button>
  );
}