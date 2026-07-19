import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { SlidersHorizontal } from 'lucide-react';
import HomeOrderEditor, { loadHomeOrder, saveHomeOrder } from '../components/layout/HomeOrderEditor';
import HeroBanner from '../components/media/HeroBanner';
import HomeSearchBar from '../components/media/HomeSearchBar';
import PullToRefresh from '../components/layout/PullToRefresh';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import ServerStatusStrip from '../components/dashboard/ServerStatusStrip';
import ServerSection from '../components/media/ServerSection';
import EmbyLibraryViews from '../components/media/EmbyLibraryViews';
import EmbyGenreRows from '../components/media/EmbyGenreRows';
import EmbyContinueWatching from '../components/media/EmbyContinueWatching';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import JellyfinRecentlyAdded from '../components/media/JellyfinRecentlyAdded';
import JellyfinContinueWatching from '../components/media/JellyfinContinueWatching';
import JellyfinLibraryViews from '../components/media/JellyfinLibraryViews';
import PlexLibraryViews from '../components/media/PlexLibraryViews';
import KidsTvRow from '../components/media/KidsTvRow';
import HomeCategoryRows from '../components/media/HomeCategoryRows';
import LazyMount from '../components/layout/LazyMount';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const queryClient = useQueryClient();

  const [showOrderEditor, setShowOrderEditor] = useState(false);
  const [sections, setSections] = useState(() => loadHomeOrder());

  const isVisible = (id) => {
    const s = sections.find(sec => sec.id === id);
    return s ? !s.hidden : true;
  };
  const orderOf = (id) => {
    const idx = sections.findIndex(sec => sec.id === id);
    return idx === -1 ? 999 : idx;
  };

  const handleOrderChange = (updated) => {
    setSections(updated);
    saveHomeOrder(updated);
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['embyRecentlyAdded'] });
    await queryClient.invalidateQueries({ queryKey: ['jellyfinRecentlyAdded'] });
    await queryClient.invalidateQueries({ queryKey: ['jellyfinContinueWatching'] });
    await queryClient.invalidateQueries({ queryKey: ['jellyfinViews'] });
    await queryClient.invalidateQueries({ queryKey: ['plexViews'] });
    await queryClient.invalidateQueries({ queryKey: ['mediaServers'] });
  };

  // Live hero — first few recently-added items from Emby, mapped to the shape
  // HeroBanner expects.
  const { data: recent } = useQuery({
    queryKey: ['embyRecentlyAdded'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyRecentlyAdded', {});
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Which servers are connected — used to show a section per server.
  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });
  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);
  const hasJellyfin = servers.some(s => s.server_type === 'jellyfin' && s.is_active !== false);
  const hasPlex = servers.some(s => s.server_type === 'plex' && s.is_active !== false);

  const featured = (recent?.items || [])
    .filter(i => i.backdropUrl || i.posterUrl)
    .slice(0, 6)
    .map(i => ({
      id: `emby:${i.id}`,
      title: i.title,
      media_type: i.type === 'Series' ? 'tv_show' : 'movie',
      backdrop_url: i.backdropUrl || i.posterUrl,
      poster_url: i.posterUrl,
      description: i.overview,
      year: i.year,
      rating: i.rating,
      genre: i.genres || [],
    }));

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div>
      <HomeSearchBar />

      <HeroBanner featured={featured} />

      <ServerStatusStrip />

      <div className="flex items-center justify-end px-4 sm:px-6 mt-3">
        <button
          onClick={() => setShowOrderEditor(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Rearrange
        </button>
      </div>

      <LibraryCategories />

      {(() => {
        // The three reorderable top-level blocks, rendered in the saved order.
        const blocks = [];

        // Continue Watching + Recently Added from the primary Emby server
        if (embyServers[0] && (isVisible('continue_watching') || isVisible('local_recent'))) {
          blocks.push({
            id: 'continue_watching',
            order: orderOf('continue_watching'),
            node: (
              <div key="cw" className="mt-6 space-y-2">
                {isVisible('continue_watching') && <EmbyContinueWatching serverId={embyServers[0].id} />}
                {isVisible('local_recent') && <EmbyRecentlyAdded serverId={embyServers[0].id} />}
              </div>
            ),
          });
        }

        // Themed rows built from the synced library
        if (isVisible('tmdb_trending') || isVisible('anime') || isVisible('kids') || isVisible('genres') || isVisible('recommendations')) {
          blocks.push({
            id: 'tmdb_trending',
            order: orderOf('tmdb_trending'),
            node: (
              <LazyMount key="themed" minHeight={360}>
                <HomeCategoryRows />
              </LazyMount>
            ),
          });
        }

        // Per-server library rows
        if (isVisible('emby_rows')) {
          blocks.push({
            id: 'emby_rows',
            order: orderOf('emby_rows'),
            node: (
              <div key="servers" className="mt-6 space-y-2">
                {embyServers.map((server, idx) => (
                  <ServerSection
                    key={server.id}
                    name={server.server_name || (embyServers.length > 1 ? `Emby ${idx + 1}` : 'Emby')}
                    accentClass="text-green-500"
                  >
                    {idx > 0 && <LazyMount><EmbyContinueWatching serverId={server.id} /></LazyMount>}
                    {idx > 0 && <LazyMount><EmbyRecentlyAdded serverId={server.id} /></LazyMount>}
                    {idx === 0 && <LazyMount minHeight={280}><KidsTvRow /></LazyMount>}
                    <LazyMount minHeight={640}><EmbyGenreRows serverId={server.id} /></LazyMount>
                    <LazyMount minHeight={640}><EmbyLibraryViews serverId={server.id} /></LazyMount>
                  </ServerSection>
                ))}

                {hasJellyfin && (
                  <ServerSection name="Jellyfin" accentClass="text-purple-500">
                    <LazyMount><JellyfinContinueWatching /></LazyMount>
                    <LazyMount><JellyfinRecentlyAdded /></LazyMount>
                    <LazyMount minHeight={640}><JellyfinLibraryViews /></LazyMount>
                  </ServerSection>
                )}

                {hasPlex && (
                  <ServerSection name="Plex" accentClass="text-yellow-500">
                    <LazyMount minHeight={640}><PlexLibraryViews /></LazyMount>
                  </ServerSection>
                )}
              </div>
            ),
          });
        }

        return blocks.sort((a, b) => a.order - b.order).map(b => b.node);
      })()}

      {showOrderEditor && (
        <HomeOrderEditor
          sections={sections}
          onChange={handleOrderChange}
          onClose={() => setShowOrderEditor(false)}
        />
      )}
    </div>
    </PullToRefresh>
  );
}