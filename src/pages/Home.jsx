import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
import MediaRow from '../components/media/MediaRow';
import ServerStatusBar from '../components/server/ServerStatusBar';
import PullToRefresh from '../components/layout/PullToRefresh';
import StatsWidget from '../components/dashboard/StatsWidget';
import SyncProgressBar from '../components/dashboard/SyncProgressBar';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import { Skeleton } from '@/components/ui/skeleton';

const TABS = ['All', 'Emby'];

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
    queryFn: () => base44.entities.Media.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-updated_date', 50),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const visibleMedia = activeTab === 'Emby'
    ? allMedia.filter(m => m.tags?.includes('emby'))
    : allMedia;

  const featured = visibleMedia.filter(m => m.is_featured);
  const movies = visibleMedia.filter(m => m.media_type === 'movie');
  const shows = visibleMedia.filter(m => m.media_type === 'tv_show');
  const recentlyAdded = [...visibleMedia].slice(0, 20);

  // Continue watching: media with incomplete watch history
  const continueWatching = watchHistory
    .filter(h => !h.completed && h.progress_seconds > 0)
    .map(h => {
      const media = allMedia.find(m => m.id === h.media_id);
      return media ? { media, history: h } : null;
    })
    .filter(Boolean);

  // Get unique genres
  const genreMap = {};
  visibleMedia.forEach(m => {
    m.genre?.forEach(g => {
      if (!genreMap[g]) genreMap[g] = [];
      genreMap[g].push(m);
    });
  });

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

      <StatsWidget />

      <SyncProgressBar />

      {/* Source tabs */}
      <div className="px-4 sm:px-6 mt-5 flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <LibraryCategories allMedia={visibleMedia} />

      <div className="mt-6 space-y-2">
        <ServerStatusBar />

        <EmbyRecentlyAdded />

        {continueWatching.length > 0 && (
          <MediaRow
            title="Continue Watching"
            items={continueWatching.map(c => c.media)}
            watchHistory={watchHistory}
            showProgress
          />
        )}

        <MediaRow title="All Recently Added" items={recentlyAdded} watchHistory={watchHistory} />
        <MediaRow title="Movies" items={movies} watchHistory={watchHistory} />
        <MediaRow title="TV Shows" items={shows} watchHistory={watchHistory} />

        {Object.entries(genreMap).slice(0, 4).map(([genre, items]) => (
          <MediaRow key={genre} title={genre} items={items} watchHistory={watchHistory} />
        ))}
      </div>
    </div>
    </PullToRefresh>
  );
}