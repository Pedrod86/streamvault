import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import HeroBanner from '../components/media/HeroBanner';
import MediaRow from '../components/media/MediaRow';
import PullToRefresh from '../components/layout/PullToRefresh';
import LibraryCategories from '../components/dashboard/LibraryCategories';
import EmbyMediaRows from '../components/media/EmbyMediaRows';
import EmbyContinueWatching from '../components/media/EmbyContinueWatching';
import HomeOrderEditor, { loadHomeOrder, saveHomeOrder } from '../components/layout/HomeOrderEditor';
import GenreRecommendations from '../components/media/GenreRecommendations';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutGrid } from 'lucide-react';

const IS_ANIME = (m) =>
  m.tags?.some(t => /^anime$/.test(t)) ||
  m.genre?.some(g => /^anime$/i.test(g));

const IS_KIDS = (m) =>
  m.tags?.some(t => /^kids?$/.test(t)) ||
  m.genre?.some(g => /kids?|children|family/i.test(g)) ||
  ['TV-Y', 'TV-G', 'G', 'TV-Y7'].includes(m.content_rating);

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Watchlist', label: 'My List' },
];

export default function Home() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');
  const [showOrderEditor, setShowOrderEditor] = useState(false);
  const [homeOrder, setHomeOrder] = useState(() => loadHomeOrder());

  const handleOrderChange = (updated) => {
    setHomeOrder(updated);
    saveHomeOrder(updated);
  };

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
        <button
          onClick={() => setShowOrderEditor(true)}
          className="shrink-0 ml-auto p-1.5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Arrange home screen"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      <LibraryCategories allMedia={allMedia} />

      <div className="mt-6 space-y-2">

        {activeTab === 'All' && (
          <>
            <EmbyContinueWatching />
            {homeOrder.filter(s => !s.hidden).map(section => {
              switch (section.id) {
                case 'live_tv':       return null;
                case 'continue_emby': return null;
                case 'recently_added': return null;
                case 'emby_rows':     return <EmbyMediaRows key={section.id} />;
                case 'continue_watching':
                  return continueWatching.length > 0 ? (
                    <MediaRow key={section.id} title="Continue Watching" items={continueWatching.map(c => c.media)} watchHistory={watchHistory} showProgress={true} />
                  ) : null;
                case 'local_recent':  return <MediaRow key={section.id} title="Recently Added" items={recentlyAdded} watchHistory={watchHistory} showProgress={true} />;
                case 'anime':         return animeItems.length > 0 ? <MediaRow key={section.id} title="Anime" items={animeItems} watchHistory={watchHistory} /> : null;
                case 'kids':          return kidsItems.length > 0 ? <MediaRow key={section.id} title="Kids" items={kidsItems} watchHistory={watchHistory} /> : null;
                case 'genres':        return (
                  <React.Fragment key={section.id}>
                    {Object.entries(genreMap).slice(0, 4).map(([genre, items]) => (
                      <MediaRow key={genre} title={genre} items={items} watchHistory={watchHistory} />
                    ))}
                  </React.Fragment>
                );
                case 'recommendations': return (
                  <GenreRecommendations key={section.id} allMedia={allMedia} watchHistory={watchHistory} />
                );
                default: return null;
              }
            })}
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
      {showOrderEditor && (
        <HomeOrderEditor
          sections={homeOrder}
          onChange={handleOrderChange}
          onClose={() => setShowOrderEditor(false)}
        />
      )}
    </PullToRefresh>
  );
}