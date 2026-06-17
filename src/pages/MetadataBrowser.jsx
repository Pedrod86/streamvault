import React, { useState } from 'react';
import { TrendingUp, Flame, Star, Calendar, Tv2, Film, Search, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { tmdb } from '@/lib/metadataService';
import TmdbRow from '@/components/discover/TmdbRow';
import TmdbDetailSheet from '@/components/discover/TmdbDetailSheet';
import TraktSyncPanel from '@/components/discover/TraktSyncPanel';

const TABS = [
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar },
  { id: 'top_rated', label: 'Top Rated', icon: Star },
  { id: 'trakt', label: 'Trakt', icon: Activity },
];

export default function MetadataBrowser() {
  const [tab, setTab] = useState('trending');
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const data = await tmdb.search(searchQuery.trim());
    setSearchResults(data?.results || []);
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-border">
        <h1 className="font-heading font-bold text-2xl text-foreground mb-1 flex items-center gap-2">
          <Film className="w-6 h-6 text-primary" /> Browse
        </h1>
        <p className="text-muted-foreground text-sm mb-4">Trending, popular & upcoming from TMDb</p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search movies & shows…"
              className="pl-9 bg-secondary border-border h-10"
            />
          </div>
          <Button type="submit" disabled={searching} className="h-10 px-4 bg-primary shrink-0">
            {searching ? 'Searching…' : 'Search'}
          </Button>
          {searchResults && (
            <Button type="button" variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="h-10">
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Search results */}
      {searchResults && (
        <div className="px-4 sm:px-6 py-4">
          <p className="text-sm text-muted-foreground mb-3">{searchResults.length} results for "{searchQuery}"</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {searchResults.map((item, i) => (
              <button key={i} onClick={() => setSelectedItem(item)} className="group">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/50 transition-all">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs px-2 text-center">{item.title}</div>
                  )}
                </div>
                <p className="mt-1 text-xs text-foreground line-clamp-2 text-left">{item.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      {!searchResults && (
        <>
          <div className="flex gap-1 px-4 sm:px-6 pt-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-6 pb-8">
            {tab === 'trakt' ? (
              <div className="px-4 sm:px-6">
                <TraktSyncPanel />
              </div>
            ) : (
              <>
                {tab === 'trending' && (
                  <>
                    <TmdbRow title="Trending Movies" queryKey={['tmdb_trending_movies']} queryFn={() => tmdb.trending('movie')} icon={TrendingUp} onSelect={setSelectedItem} />
                    <TmdbRow title="Trending TV Shows" queryKey={['tmdb_trending_tv']} queryFn={() => tmdb.trending('tv')} icon={Tv2} onSelect={setSelectedItem} />
                  </>
                )}
                {tab === 'popular' && (
                  <>
                    <TmdbRow title="Popular Movies" queryKey={['tmdb_popular_movies']} queryFn={() => tmdb.popular('movie')} icon={Flame} onSelect={setSelectedItem} />
                    <TmdbRow title="Popular TV Shows" queryKey={['tmdb_popular_tv']} queryFn={() => tmdb.popular('tv')} icon={Tv2} onSelect={setSelectedItem} />
                  </>
                )}
                {tab === 'upcoming' && (
                  <TmdbRow title="Upcoming Movies" queryKey={['tmdb_upcoming']} queryFn={() => tmdb.upcoming()} icon={Calendar} onSelect={setSelectedItem} />
                )}
                {tab === 'top_rated' && (
                  <>
                    <TmdbRow title="Top Rated Movies" queryKey={['tmdb_top_movies']} queryFn={() => tmdb.topRated('movie')} icon={Star} onSelect={setSelectedItem} />
                    <TmdbRow title="Top Rated TV Shows" queryKey={['tmdb_top_tv']} queryFn={() => tmdb.topRated('tv')} icon={Star} onSelect={setSelectedItem} />
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Detail sheet */}
      {selectedItem && <TmdbDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}