import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import MediaGrid from '../components/media/MediaGrid';
import GenreFilter from '../components/media/GenreFilter';
import PullToRefresh from '../components/layout/PullToRefresh';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Shows() {
  const queryClient = useQueryClient();
  const [genre, setGenre] = useState('All');
  const [sortBy, setSortBy] = useState('recent');

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['shows'] });
    await queryClient.invalidateQueries({ queryKey: ['watchHistory'] });
  };

  const { data: shows = [], isLoading } = useQuery({
    queryKey: ['shows'],
    queryFn: () => base44.entities.Media.filter({ media_type: 'tv_show' }, '-created_date', 200),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-updated_date', 200),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  let filtered = genre === 'All' ? shows : shows.filter(m => m.genre?.includes(genre));

  if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === 'year') {
    filtered = [...filtered].sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sortBy === 'title') {
    filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">TV Shows</h1>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 bg-secondary border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="year">Newest First</SelectItem>
            <SelectItem value="title">A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <GenreFilter selected={genre} onChange={setGenre} />

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-secondary" />
            ))}
          </div>
        ) : (
          <MediaGrid items={filtered} watchHistory={watchHistory} />
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}