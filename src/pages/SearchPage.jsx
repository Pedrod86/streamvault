import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import EmbyBrowseGrid from '../components/media/EmbyBrowseGrid';

const PAGE_SIZE = 48;

export default function SearchPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const debouncedQuery = useDebounce(query, 400);
  const isFirstRun = React.useRef(true);

  // Reset to the first page whenever the search term changes.
  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    setPage(0);
  }, [debouncedQuery]);

  const trimmed = debouncedQuery.trim();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['embySearch', trimmed, page],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyLibrary', {
        startIndex: page * PAGE_SIZE,
        pageSize: PAGE_SIZE,
        search: trimmed,
        sortBy: 'SortName',
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    enabled: !!trimmed,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const server = data?.server;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, shows, genres, cast..."
            className="pl-10 h-12 bg-secondary border-border text-foreground text-base rounded-xl"
          />
        </div>
      </div>

      {trimmed ? (
        <>
          <p className="text-muted-foreground text-sm mb-4">
            {total.toLocaleString()} result{total !== 1 ? 's' : ''} for "{trimmed}"
          </p>
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
        </>
      ) : (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Search your library</p>
          <p className="text-muted-foreground text-sm mt-1">Find movies, TV shows, actors, and more</p>
        </div>
      )}
    </div>
  );
}