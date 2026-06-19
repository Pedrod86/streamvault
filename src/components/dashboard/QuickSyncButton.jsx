import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, RefreshCw } from 'lucide-react';

// Quick Sync — scans the entire Emby library and adds only the items missing
// from the database. Same logic that used to live in Settings, surfaced on the
// home page Library header for one-tap access.
export default function QuickSyncButton() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ fetched: 0, created: 0 });

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);

  const run = async () => {
    if (embyServers.length === 0 || status === 'running') return;
    setStatus('running');
    setStats({ fetched: 0, created: 0 });

    let totalFetched = 0, totalCreated = 0;

    try {
      for (const server of embyServers) {
        let startIndex = 0;
        const PAGE = 500;

        while (true) {
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
          totalCreated += res2.data?.created || 0;
          setStats({ fetched: totalFetched, created: totalCreated });

          if (!hasMore) break;
          startIndex += items.length;
          await new Promise(r => setTimeout(r, 600));
        }
      }

      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setTimeout(() => setStatus('idle'), 5000);
    } catch (e) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  if (embyServers.length === 0) return null;

  return (
    <button
      onClick={run}
      disabled={status === 'running'}
      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-70"
    >
      {status === 'running' ? (
        <><RefreshCw className="w-3 h-3 animate-spin" /> Syncing {stats.created > 0 ? `(+${stats.created})` : '…'}</>
      ) : status === 'done' ? (
        <><Zap className="w-3 h-3" /> +{stats.created} added</>
      ) : status === 'error' ? (
        <><Zap className="w-3 h-3" /> Sync failed</>
      ) : (
        <><Zap className="w-3 h-3" /> Quick Sync</>
      )}
    </button>
  );
}