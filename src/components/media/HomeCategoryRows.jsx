import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import MediaRow from './MediaRow';

// Matchers for the themed rows, run against synced Media records.
const is4k = (m) =>
  m.tags?.some(t => /4k|2160p|uhd/i.test(t)) ||
  /\b(4K|UHD|2160p)\b/i.test(m.title || '');

const isAnime = (m) =>
  m.genre?.some(g => /^anime$/i.test(g)) ||
  m.tags?.some(t => /^anime$/i.test(t));

const isDocumentary = (m) =>
  m.genre?.some(g => /document/i.test(g)) ||
  m.tags?.some(t => /document/i.test(t));

// Score a title for "trending": prefer highly-rated, recent movies.
const trendingScore = (m) => (m.rating || 0) + (m.year ? (m.year - 1990) / 25 : 0);

export default function HomeCategoryRows() {
  const { data: media = [], isLoading } = useQuery({
    queryKey: ['media', 'home-rows'],
    queryFn: () => base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 2000),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-10 mt-6">
        {[1, 2, 3].map(row => (
          <div key={row}>
            <Skeleton className="h-6 w-48 mb-4 mx-4 sm:mx-6 bg-secondary" />
            <div className="flex gap-4 px-4 sm:px-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px] aspect-[2/3] rounded-xl bg-secondary" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const movies = media.filter(m => m.media_type === 'movie');
  const shows = media.filter(m => m.media_type === 'tv_show');

  const trendingMovies = [...movies].sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, 24);
  const fourKMovies = movies.filter(is4k).slice(0, 24);
  const tvShows = [...shows].slice(0, 24);
  const anime = media.filter(isAnime).slice(0, 24);
  const documentaries = media.filter(isDocumentary).slice(0, 24);

  return (
    <div className="mt-6">
      <MediaRow title="Trending Movies" items={trendingMovies} />
      <MediaRow title="4K Movies" items={fourKMovies} />
      <MediaRow title="TV Shows" items={tvShows} />
      <MediaRow title="Anime" items={anime} />
      <MediaRow title="Documentaries" items={documentaries} />
    </div>
  );
}