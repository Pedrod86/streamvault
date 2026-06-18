import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Tv, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebounce } from '../hooks/useDebounce';
import EmbyBrowseGrid from '../components/media/EmbyBrowseGrid';
import LibraryFilterBar from '../components/media/LibraryFilterBar';

const PAGE_SIZE = 48;

export default function Shows() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [years, setYears] = useState('');
  const [sortBy, setSortBy] = useState('SortName');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => { setPage(0); }, [debouncedSearch, genre, years, sortBy]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['embyShows', page, debouncedSearch, genre, years, sortBy],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyLibrary', {
        startIndex: page * PAGE_SIZE,
        pageSize: PAGE_SIZE,
        itemType: 'Series',
        search: debouncedSearch,
        genre,
        years,
        sortBy,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    keepPreviousData: true,
  });

  const { data: genreData } = useQuery({
    queryKey: ['embyShowGenres'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyGenres', { itemType: 'Series' });
      return res.data?.genres || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const server = data?.server;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Tv className="w-6 h-6 text-primary" />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">TV Shows</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
              {total.toLocaleString()}
            </span>
          )}
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 bg-secondary border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="SortName">A–Z</SelectItem>
            <SelectItem value="DateCreated,Descending">Recently Added</SelectItem>
            <SelectItem value="CommunityRating,Descending">Highest Rated</SelectItem>
            <SelectItem value="ProductionYear,Descending">Newest First</SelectItem>
            <SelectItem value="ProductionYear,Ascending">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search TV shows…"
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </div>

      {/* Genre + Year filter buttons */}
      <LibraryFilterBar
        genres={genreData || []}
        genre={genre}
        onGenreChange={setGenre}
        years={years}
        onYearsChange={setYears}
      />

      <EmbyBrowseGrid items={items} server={server} isLoading={isLoading || isFetching} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages.toLocaleString()}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}