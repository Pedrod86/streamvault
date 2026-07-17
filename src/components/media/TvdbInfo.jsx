import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tv2, Star } from 'lucide-react';

// Auto-loads TVDB metadata (rating, status, network, genres, overview) by
// title + year and shows it inline on the detail page — no button/prompt.
export default function TvdbInfo({ title, year, mediaType }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tvdbInfo', title, year, mediaType],
    enabled: !!title,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const res = await base44.functions.invoke('tvdbLookup', {
        title,
        year,
        type: mediaType,
      });
      if (res.data?.error) return null;
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="mb-8 rounded-xl border border-border/60 p-4 bg-card/40">
        <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const chips = [
    data.year && String(data.year),
    data.status,
    data.contentRating,
    data.network,
    data.seasonCount ? `${data.seasonCount} seasons` : null,
  ].filter(Boolean);

  if (!chips.length && !data.overview && !data.genres?.length && !data.rating) return null;

  return (
    <div className="mb-8">
      <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
        <Tv2 className="w-4 h-4 text-blue-400" /> TVDB
        {data.rating && (
          <span className="flex items-center gap-1 text-sm text-blue-400 font-semibold ml-1">
            <Star className="w-3.5 h-3.5 fill-blue-400" /> {data.rating}
          </span>
        )}
      </h3>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c, i) => (
            <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
      )}

      {data.genres?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.genres.slice(0, 6).map(g => (
            <span key={g} className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      )}

      {data.overview && (
        <p className="text-sm text-muted-foreground leading-relaxed">{data.overview}</p>
      )}
    </div>
  );
}