import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmbyBrowseGrid from '../components/media/EmbyBrowseGrid';

const PAGE_SIZE = 48;

// A small palette of gradient combos so each genre tile looks distinct.
const GRADIENTS = [
  'from-rose-500/80 to-orange-500/80',
  'from-blue-500/80 to-cyan-500/80',
  'from-violet-500/80 to-fuchsia-500/80',
  'from-emerald-500/80 to-teal-500/80',
  'from-amber-500/80 to-yellow-500/80',
  'from-indigo-500/80 to-blue-600/80',
  'from-pink-500/80 to-rose-600/80',
  'from-lime-500/80 to-green-600/80',
  'from-sky-500/80 to-indigo-500/80',
  'from-red-500/80 to-pink-600/80',
];

function GenreTile({ genre, index, onSelect }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <button
      onClick={() => onSelect(genre)}
      className={`tv-focusable group relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} p-4 flex items-end text-left transition-transform duration-200 hover:scale-[1.03] focus:scale-[1.03]`}
    >
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
      <Tag className="absolute top-3 right-3 w-5 h-5 text-white/70" />
      <span className="relative z-10 font-heading font-bold text-lg sm:text-xl text-white drop-shadow-lg">
        {genre}
      </span>
    </button>
  );
}

export default function Genres() {
  const [activeGenre, setActiveGenre] = useState('');
  const [page, setPage] = useState(0);

  // All genres across movies + series.
  const { data: genres = [], isLoading: loadingGenres } = useQuery({
    queryKey: ['allEmbyGenres'],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyGenres', { itemType: '' });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.genres || [];
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Titles within the selected genre.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['embyGenreTitles', activeGenre, page],
    queryFn: async () => {
      const res = await base44.functions.invoke('embyLibrary', {
        startIndex: page * PAGE_SIZE,
        pageSize: PAGE_SIZE,
        itemType: '',
        genre: activeGenre,
        sortBy: 'SortName',
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    enabled: !!activeGenre,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    keepPreviousData: true,
  });

  const openGenre = (g) => {
    setActiveGenre(g);
    setPage(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const server = data?.server;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        {activeGenre ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveGenre('')}
            className="gap-1.5 -ml-2"
          >
            <ChevronLeft className="w-4 h-4" /> All Genres
          </Button>
        ) : (
          <LayoutGrid className="w-6 h-6 text-primary" />
        )}
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
          {activeGenre || 'Browse by Genre'}
        </h1>
        {activeGenre && total > 0 && (
          <span className="text-sm text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
            {total.toLocaleString()}
          </span>
        )}
      </div>

      {!activeGenre ? (
        loadingGenres ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[16/9] rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : genres.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No genres found — sync your Emby library first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {genres.map((g, i) => (
              <GenreTile key={g} genre={g} index={i} onSelect={openGenre} />
            ))}
          </div>
        )
      ) : (
        <>
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
      )}
    </div>
  );
}