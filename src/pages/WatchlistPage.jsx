import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import MediaGrid from '../components/media/MediaGrid';
import { Skeleton } from '@/components/ui/skeleton';
import { BookmarkPlus, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const [activeCollection, setActiveCollection] = useState(null); // null = My List

  const { data: watchlist = [], isLoading: wlLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date', 200),
  });

  const { data: allMedia = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 500),
  });

  const { data: collections = [], isLoading: colLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => base44.entities.Collection.list('-created_date', 100),
  });

  const deleteCollection = useMutation({
    mutationFn: (id) => base44.entities.Collection.delete(id),
    onSuccess: () => {
      setActiveCollection(null);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const isLoading = wlLoading || mediaLoading || colLoading;

  const watchlistMedia = watchlist
    .map(w => allMedia.find(m => m.id === w.media_id))
    .filter(Boolean);

  const selectedCollection = collections.find(c => c.id === activeCollection);
  const collectionMedia = selectedCollection
    ? (selectedCollection.media_ids || []).map(id => allMedia.find(m => m.id === id)).filter(Boolean)
    : [];

  const displayMedia = activeCollection ? collectionMedia : watchlistMedia;
  const displayTitle = activeCollection ? selectedCollection?.name : 'My List';
  const isEmpty = displayMedia.length === 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Tabs: My List + Collections */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCollection(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !activeCollection
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          My List
          <span className="ml-1.5 text-xs opacity-70">({watchlistMedia.length})</span>
        </button>

        {collections.map(col => (
          <button
            key={col.id}
            onClick={() => setActiveCollection(col.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeCollection === col.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {col.name}
            <span className="text-xs opacity-70">({(col.media_ids || []).length})</span>
          </button>
        ))}
      </div>

      {/* Title + delete collection button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">{displayTitle}</h1>
        {activeCollection && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive gap-1.5"
            onClick={() => deleteCollection.mutate(activeCollection)}
            disabled={deleteCollection.isPending}
          >
            <Trash2 className="w-4 h-4" /> Delete Collection
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-secondary" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="text-center py-20">
          <BookmarkPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">
            {activeCollection ? 'This collection is empty' : 'Your watchlist is empty'}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCollection
              ? 'Go to a media page and add it to this collection'
              : 'Browse and add movies or shows to your list'}
          </p>
        </div>
      ) : (
        <MediaGrid items={displayMedia} />
      )}
    </div>
  );
}