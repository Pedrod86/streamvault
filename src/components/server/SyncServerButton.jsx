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
      let items;
      try {
        items = await fetchServerLibrary(server);
      } catch (err) {
        const isCors = err.message === 'Failed to fetch' || err.name === 'TypeError';
        if (isCors) {
          throw new Error('Cannot reach server. If it\'s on your local network, ensure CORS is enabled in your Emby/Jellyfin settings, or that the server URL is accessible from this browser.');
        }
        throw err;
      }

      if (!items.length) {
        setCount(0);
        return 0;
      }

      // 2. Get existing media to update video_url on existing items
      const existing = await base44.entities.Media.list('-created_date', 500);
      const existingMap = new Map(existing.map(m => [m.title.toLowerCase().trim(), m]));

      // 3. Split into new vs existing
      const newItems = [];
      const updatePromises = [];
      for (const item of items) {
        const key = item.title.toLowerCase().trim();
        const existingItem = existingMap.get(key);
        if (existingItem) {
          // Update video_url if we now have one and it was missing
          if (item.video_url && !existingItem.video_url) {
            updatePromises.push(
              base44.entities.Media.update(existingItem.id, { video_url: item.video_url })
            );
          }
        } else {
          newItems.push(item);
        }
      }

      // Run updates in parallel
      if (updatePromises.length) await Promise.all(updatePromises);

      if (!newItems.length) {
        setCount(updatePromises.length > 0 ? -updatePromises.length : 0);
        return updatePromises.length > 0 ? -updatePromises.length : 0;
      }

      // 4. Bulk create new items in batches of 50
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
        {count > 0 ? `${count} items imported` : count < 0 ? `${Math.abs(count)} items updated` : 'Already up to date'}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-1 text-xs text-destructive font-medium max-w-[280px]">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">Sync failed</span>
        </div>
        <span className="text-destructive/80 leading-snug">{errorMsg}</span>
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