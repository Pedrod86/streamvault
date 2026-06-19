import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
import MediaRow from '../components/media/MediaRow';
import PullToRefresh from '../components/layout/PullToRefresh';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import EmbyLibraryViews from '../components/media/EmbyLibraryViews';
import EmbyContinueWatching from '../components/media/EmbyContinueWatching';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import { Skeleton } from '@/components/ui/skeleton';

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Watchlist', label: 'My List' },
];

export default function Home() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['media'] });
    await queryClient.invalidateQueries({ queryKey: ['watchHistory'] });
    await queryClient.invalidateQueries({ queryKey: ['mediaServers'] });
  };

  const { data: allMedia = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 200),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-updated_date', 50),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: watchlistItems = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date', 200),
    staleTime: 5 * 60 * 1000,
  });

  const watchlistMediaIds = new Set(watchlistItems.map(w => w.media_id));

  const visibleMedia =
    activeTab === 'Watchlist' ? allMedia.filter(m => watchlistMediaIds.has(m.id)) :
    allMedia;

  const featured = visibleMedia.filter(m => m.is_featured);
  const recentlyAdded = [...visibleMedia].slice(0, 20);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-[70vh] w-full bg-secondary" />
        <div className="p-6 space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <Skeleton className="h-6 w-40 mb-4 bg-secondary" />
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map(j => (
                  <Skeleton key={j} className="w-[160px] h-[260px] rounded-xl bg-secondary shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div>
      <HeroBanner featured={featured.length > 0 ? featured : recentlyAdded.slice(0, 5)} />

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

      <LibraryCategories allMedia={allMedia} />

      <div className="mt-6 space-y-2">

        {activeTab === 'All' && (
          <>
            <EmbyContinueWatching />
            <EmbyRecentlyAdded />
            <EmbyLibraryViews />
          </>
        )}

        {activeTab === 'Watchlist' && (
          visibleMedia.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Your watchlist is empty. Add items by pressing the bookmark icon on any title.
            </div>
          ) : (
            <MediaRow title="My Watchlist" items={visibleMedia} watchHistory={watchHistory} />
          )
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}