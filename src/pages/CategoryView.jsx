import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaGrid from '../components/media/MediaGrid';
import CategoryFilters from '../components/media/CategoryFilters';

const typeOf = (m) => m.media_type || (m.type === 'Series' ? 'tv_show' : 'movie');
const genresOf = (m) => m.genre || m.genres || [];

export default function CategoryView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { title = 'Category', items = [] } = location.state || {};

  const [typeFilter, setTypeFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-updated_date', 50),
    staleTime: 5 * 60 * 1000,
  });

  // Genres available within the current type selection
  const genres = useMemo(() => {
    const pool = typeFilter === 'all' ? items : items.filter(m => typeOf(m) === typeFilter);
    const set = new Set();
    pool.forEach(m => genresOf(m).forEach(g => g && set.add(g)));
    return [...set].sort();
  }, [items, typeFilter]);

  const filtered = useMemo(() => {
    return items.filter(m => {
      if (typeFilter !== 'all' && typeOf(m) !== typeFilter) return false;
      if (genreFilter !== 'all' && !genresOf(m).includes(genreFilter)) return false;
      return true;
    });
  }, [items, typeFilter, genreFilter]);

  const handleTypeChange = (t) => {
    setTypeFilter(t);
    setGenreFilter('all'); // reset genre when switching type
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-bold text-2xl text-foreground">{title}</h1>
        <span className="text-sm text-muted-foreground ml-1">({filtered.length})</span>
      </div>

      <CategoryFilters
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        genreFilter={genreFilter}
        onGenreChange={setGenreFilter}
        genres={genres}
      />

      <MediaGrid items={filtered} watchHistory={watchHistory} />
    </div>
  );
}