import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
import MediaRow from '../components/media/MediaRow';
import ServerStatusBar from '../components/server/ServerStatusBar';
import PullToRefresh from '../components/layout/PullToRefresh';
import SyncProgressBar from '../components/dashboard/SyncProgressBar';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import EmbyMediaRows from '../components/media/EmbyMediaRows';
import { Skeleton } from '@/components/ui/skeleton';

const IS_ANIME = (m) =>
  m.tags?.some(t => /^anime$/.test(t)) ||
  m.genre?.some(g => /^anime$/i.test(g));

const IS_KIDS = (m) =>
  m.tags?.some(t => /^kids?$/.test(t)) ||
  m.genre?.some(g => /kids?|children|family/i.test(g)) ||
  ['TV-Y', 'TV-G', 'G', 'TV-Y7'].includes(m.content_rating);

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Movies', label: 'Movies' },
  { id: 'Shows', label: 'TV Shows' },
  { id: 'Anime', label: 'Anime' },
  { id: 'Kids', label: 'Kids' },
  { id: 'Watchlist', label: 'Watchlist' },
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

  const { data: watchlistItems = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date', 200),
    staleTime: 5 * 60 * 1000,
  });

  const watchlistMediaIds = new Set(watchlistItems.map(w => w.media_id));

  const visibleMedia =
    activeTab === 'Movies'   ? allMedia.filter(m => m.media_type === 'movie') :
    activeTab === 'Shows'    ? allMedia.filter(m => m.media_type === 'tv_show') :
    activeTab === 'Anime'    ? allMedia.filter(IS_ANIME) :
    activeTab === 'Kids'     ? allMedia.filter(IS_KIDS) :
    activeTab === 'Watchlist'? allMedia.filter(m => watchlistMediaIds.has(m.id)) :
    allMedia;

  const featured = visibleMedia.filter(m => m.is_featured);
  const movies = visibleMedia.filter(m => m.media_type === 'movie');
  const shows = visibleMedia.filter(m => m.media_type === 'tv_show');
  const animeItems = allMedia.filter(IS_ANIME);
  const kidsItems = allMedia.filter(IS_KIDS);
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

      <SyncProgressBar />

      {/* Filter tabs */}
      <div className="px-4 sm:px-6 mt-5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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

      <LibraryCategories allMedia={visibleMedia} />

      <div className="mt-6 space-y-2">
        <ServerStatusBar />

        {activeTab === 'All' && (
          <>
            <EmbyRecentlyAdded />
            {continueWatching.length > 0 && (
              <MediaRow
                title="Continue Watching"
                items={continueWatching.map(c => c.media)}
                watchHistory={watchHistory}
                showProgress
              />
            )}
            <MediaRow title="Recently Added" items={recentlyAdded} watchHistory={watchHistory} />
            {animeItems.length > 0 && (
              <MediaRow title="Anime" items={animeItems} watchHistory={watchHistory} />
            )}
            {kidsItems.length > 0 && (
              <MediaRow title="Kids" items={kidsItems} watchHistory={watchHistory} />
            )}
            <EmbyMediaRows />
            {Object.entries(genreMap).slice(0, 4).map(([genre, items]) => (
              <MediaRow key={genre} title={genre} items={items} watchHistory={watchHistory} />
            ))}
          </>
        )}

        {activeTab === 'Movies' && (
          <>
            <MediaRow title="All Movies" items={movies} watchHistory={watchHistory} />
            {Object.entries(genreMap).filter(([, items]) => items.some(i => i.media_type === 'movie')).slice(0, 5).map(([genre, items]) => (
              <MediaRow key={genre} title={genre} items={items.filter(i => i.media_type === 'movie')} watchHistory={watchHistory} />
            ))}
          </>
        )}

        {activeTab === 'Shows' && (
          <>
            <MediaRow title="All TV Shows" items={shows} watchHistory={watchHistory} />
            {Object.entries(genreMap).filter(([, items]) => items.some(i => i.media_type === 'tv_show')).slice(0, 5).map(([genre, items]) => (
              <MediaRow key={genre} title={genre} items={items.filter(i => i.media_type === 'tv_show')} watchHistory={watchHistory} />
            ))}
          </>
        )}

        {activeTab === 'Anime' && (
          visibleMedia.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No anime found. Anime is auto-detected from genres during sync.
            </div>
          ) : (
            <>
              <MediaRow title="All Anime" items={visibleMedia} watchHistory={watchHistory} />
              {Object.entries(
                visibleMedia.reduce((acc, m) => {
                  m.genre?.forEach(g => { if (!/^anime$/i.test(g)) { if (!acc[g]) acc[g] = []; acc[g].push(m); } });
                  return acc;
                }, {})
              ).slice(0, 5).map(([genre, items]) => (
                <MediaRow key={genre} title={genre} items={items} watchHistory={watchHistory} />
              ))}
            </>
          )
        )}

        {activeTab === 'Kids' && (
          visibleMedia.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No kids content found. Kids content is auto-detected from genres and ratings during sync.
            </div>
          ) : (
            <>
              <MediaRow title="All Kids" items={visibleMedia} watchHistory={watchHistory} />
              {Object.entries(
                visibleMedia.reduce((acc, m) => {
                  m.genre?.forEach(g => { if (!acc[g]) acc[g] = []; acc[g].push(m); });
                  return acc;
                }, {})
              ).slice(0, 5).map(([genre, items]) => (
                <MediaRow key={genre} title={genre} items={items} watchHistory={watchHistory} />
              ))}
            </>
          )
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