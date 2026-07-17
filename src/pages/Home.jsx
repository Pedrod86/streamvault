import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
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
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const queryClient = useQueryClient();

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
    .filter(i => i.type === 'Movie')
    .slice(0, 5)
    .map(i => ({
      id: `emby:${i.id}`,
      title: i.title,
      media_type: 'movie',
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
      <HeroBanner featured={featured} />

      <ServerStatusStrip />

      <LibraryCategories />

      <div className="mt-6 space-y-2">

        {embyServers.map((server, idx) => (
          <ServerSection
            key={server.id}
            name={server.server_name || (embyServers.length > 1 ? `Emby ${idx + 1}` : 'Emby')}
            accentClass="text-green-500"
          >
            <EmbyContinueWatching serverId={server.id} />
            <EmbyRecentlyAdded serverId={server.id} />
            {idx === 0 && <KidsTvRow />}
            <EmbyGenreRows serverId={server.id} />
            <EmbyLibraryViews serverId={server.id} />
          </ServerSection>
        ))}

        {hasJellyfin && (
          <ServerSection name="Jellyfin" accentClass="text-purple-500">
            <JellyfinContinueWatching />
            <JellyfinRecentlyAdded />
            <JellyfinLibraryViews />
          </ServerSection>
        )}

        {hasPlex && (
          <ServerSection name="Plex" accentClass="text-yellow-500">
            <PlexLibraryViews />
          </ServerSection>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}