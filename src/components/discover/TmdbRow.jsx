import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tmdb, preloadImages } from '@/lib/metadataService';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

function TmdbCard({ item, onSelect }) {
  const hasPoster = !!item.poster;
  return (
    <button
      onClick={() => onSelect?.(item)}
      className="shrink-0 w-[140px] sm:w-[160px] group"
    >
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-secondary border border-border group-hover:border-primary/50 transition-all shadow-md">
        {hasPoster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs px-2 text-center">
            {item.title}
          </div>
        )}
        {item.rating > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded-md px-1.5 py-0.5 text-[11px] text-amber-400">
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            {item.rating?.toFixed(1)}
          </div>
        )}
        {item.year && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-[10px] text-white/70">
            {item.year}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-foreground font-medium leading-tight line-clamp-2 text-left px-0.5">
        {item.title}
      </p>
    </button>
  );
}

export default function TmdbRow({ title, queryKey, queryFn, icon: RowIcon = TrendingUp, onSelect }) {
  const Icon = RowIcon;
  const rowRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    onSuccess: (d) => {
      if (d?.results) preloadImages(d.results.slice(0, 6).map(r => r.poster_thumb || r.poster));
    },
  });

  const items = data?.results || [];

  const scroll = (dir) => {
    if (rowRef.current) rowRef.current.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  return (
    <div className="px-4 sm:px-6 py-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          {title}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="w-7 h-7 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => scroll(1)} className="w-7 h-7 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="shrink-0 w-[140px] sm:w-[160px] aspect-[2/3] rounded-xl bg-secondary" />
          ))}
        </div>
      ) : items.length === 0 ? null : (
        <div ref={rowRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {items.map((item, i) => (
            <TmdbCard key={`${item.tmdb_id}-${i}`} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}