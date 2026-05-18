import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

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
        const isCors = err.message === 'Failed to fetch' || err.name === 'TypeError' || err instanceof TypeError;
        if (isCors) {
          throw new Error(server.server_type === 'xtream' ? 'CORS_XTREAM' : 'CORS_BLOCKED');
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
    const isCors = errorMsg === 'CORS_BLOCKED';
    const isXtreamCors = errorMsg === 'CORS_XTREAM';
    return (
      <div className="flex flex-col gap-1.5 text-xs font-medium max-w-[320px]">
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">{(isCors || isXtreamCors) ? 'Network blocked by browser' : 'Sync failed'}</span>
        </div>
        {isXtreamCors ? (
          <div className="text-muted-foreground leading-snug space-y-1">
            <p>Your IPTV provider uses <strong className="text-foreground">HTTP (not HTTPS)</strong>, which browsers block from secure pages (mixed content).</p>
            <p className="font-medium text-foreground">To work around this:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground/80">
              <li>Open the app in <strong className="text-foreground">Chrome</strong>, click the lock/info icon in the address bar</li>
              <li>Go to <strong className="text-foreground">Site settings → Insecure content</strong> and set to <strong className="text-foreground">Allow</strong></li>
              <li>Reload the page and try syncing again</li>
            </ol>
            <p className="text-muted-foreground/70 mt-1">Alternatively, ask your provider if they support HTTPS.</p>
          </div>
        ) : isCors ? (
          <div className="text-muted-foreground leading-snug space-y-1">
            <p>Your browser is blocking requests to the media server. To fix this:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground/80">
              <li>Open your <strong className="text-foreground">Emby/Jellyfin Dashboard</strong></li>
              <li>Go to <strong className="text-foreground">Advanced → Networking</strong></li>
              <li>Add <code className="bg-secondary px-1 rounded text-foreground">https://streamvault-now.base44.app</code> to <strong className="text-foreground">Known Proxies / CORS Origins</strong></li>
              <li>Make sure your server URL uses <strong className="text-foreground">https://</strong></li>
            </ol>
          </div>
        ) : (
          <span className="text-destructive/80 leading-snug">{errorMsg}</span>
        )}
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