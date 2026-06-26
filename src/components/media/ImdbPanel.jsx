import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, Award, ExternalLink, ChevronDown, ChevronUp, Loader2, Clock, Clapperboard, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImdbPanel({ media }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    if (data) { setExpanded(e => !e); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('imdbLookup', {
        title: media.title,
        year: media.year,
        type: media.media_type,
      });
      setData(res.data);
      setExpanded(true);
    } catch (e) {
      setError('Could not load IMDb data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden mb-6">
      {/* Header button */}
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 rounded bg-yellow-400 flex items-center justify-center">
            <span className="text-[9px] font-black text-black leading-none">IMDb</span>
          </div>
          <span className="text-sm font-medium text-foreground">IMDb Info</span>
          {data?.imdbRating && (
            <span className="flex items-center gap-1 text-yellow-400 text-sm font-semibold ml-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400" />
              {data.imdbRating}
            </span>
          )}
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        ) : expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && data && (
        <div className="px-4 pb-4 pt-2 bg-card/50 space-y-3">
          {/* Ratings row */}
          <div className="flex flex-wrap gap-3">
            {data.imdbRating && (
              <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-1.5">
                <div className="w-7 h-3.5 rounded bg-yellow-400 flex items-center justify-center shrink-0">
                  <span className="text-[7px] font-black text-black">IMDb</span>
                </div>
                <span className="text-sm font-semibold text-yellow-400">{data.imdbRating}/10</span>
                {data.imdbVotes && <span className="text-xs text-muted-foreground">({data.imdbVotes} votes)</span>}
              </div>
            )}
            {data.rottenTomatoes && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                <span className="text-sm">🍅</span>
                <span className="text-sm font-semibold text-red-400">{data.rottenTomatoes}</span>
              </div>
            )}
            {data.metascore && (
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5">
                <span className="text-xs font-bold text-green-400 bg-green-400/20 px-1 rounded">MC</span>
                <span className="text-sm font-semibold text-green-400">{data.metascore}/100</span>
              </div>
            )}
          </div>

          {/* Quick facts */}
          {(data.runtime || data.rated || data.year) && (
            <div className="flex flex-wrap gap-2">
              {data.year && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{data.year}</span>}
              {data.rated && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{data.rated}</span>}
              {data.runtime && (
                <span className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                  <Clock className="w-3 h-3" /> {data.runtime}
                </span>
              )}
            </div>
          )}

          {/* Genres */}
          {data.genre?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.genre.map(g => (
                <span key={g} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{g}</span>
              ))}
            </div>
          )}

          {/* Plot */}
          {data.plot && (
            <p className="text-xs text-muted-foreground leading-relaxed">{data.plot}</p>
          )}

          {/* Director */}
          {data.director && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clapperboard className="w-3.5 h-3.5 shrink-0" />
              <span><span className="text-foreground font-medium">Director:</span> {data.director}</span>
            </div>
          )}

          {/* Cast */}
          {data.cast?.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span><span className="text-foreground font-medium">Cast:</span> {data.cast.join(', ')}</span>
            </div>
          )}

          {/* Awards */}
          {data.awards && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Award className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <span>{data.awards}</span>
            </div>
          )}

          {/* IMDb link */}
          {data.imdbId && (
            <a
              href={`https://www.imdb.com/title/${data.imdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View on IMDb
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-card/50 text-xs text-muted-foreground">{error}</div>
      )}
    </div>
  );
}