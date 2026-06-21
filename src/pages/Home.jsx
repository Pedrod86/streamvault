import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
import PullToRefresh from '../components/layout/PullToRefresh';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import EmbyLibraryViews from '../components/media/EmbyLibraryViews';
import EmbyContinueWatching from '../components/media/EmbyContinueWatching';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import EmbyWatchlistRow from '../components/media/EmbyWatchlistRow';
import KidsTvRow from '../components/media/KidsTvRow';
import { Skeleton } from '@/components/ui/skeleton';

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Watchlist', label: 'My List' },
];

export default function Home() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['embyRecentlyAdded'] });
    await queryClient.invalidateQueries({ queryKey: ['watchlist'] });
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

      {/* Filter tabs + arrange button */}
      <div className="px-4 sm:px-6 mt-5 flex gap-2 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <LibraryCategories />

      <div className="mt-6 space-y-2">

        {activeTab === 'All' && (
          <>
            <EmbyContinueWatching />
            <EmbyRecentlyAdded />
            <KidsTvRow />
            <EmbyLibraryViews />
          </>
        )}

        {activeTab === 'Watchlist' && <EmbyWatchlistRow />}
      </div>
    </div>
    </PullToRefresh>
  );
}