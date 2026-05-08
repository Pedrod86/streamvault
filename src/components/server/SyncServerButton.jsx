import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
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

      // 1. Fetch all items from the media server
      const items = await fetchServerLibrary(server);

      if (!items.length) {
        setCount(0);
        return 0;
      }

      // 2. Get existing media titles to avoid duplicates
      const existing = await base44.entities.Media.list('-created_date', 500);
      const existingTitles = new Set(existing.map(m => m.title.toLowerCase().trim()));

      // 3. Filter out already-imported items
      const newItems = items.filter(
        item => !existingTitles.has(item.title.toLowerCase().trim())
      );

      if (!newItems.length) {
        setCount(0);
        return 0;
      }

      // 4. Bulk create in batches of 50
      const BATCH = 50;
      let created = 0;
      for (let i = 0; i < newItems.length; i += BATCH) {
        const batch = newItems.slice(i, i + BATCH);
        await base44.entities.Media.bulkCreate(batch);
        created += batch.length;
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
        {count > 0 ? `${count} items imported` : 'Already up to date'}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive font-medium max-w-[200px]">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{errorMsg}</span>
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
      {status === 'syncing' ? 'Syncing…' : 'Sync Library'}
    </Button>
  );
}