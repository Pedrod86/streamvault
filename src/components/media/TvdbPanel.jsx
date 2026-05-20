import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Tv2, ChevronDown, ChevronUp, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TvdbPanel({ media, onEnriched }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    if (data) { setExpanded(e => !e); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('tvdbLookup', {
        title: media.title,
        year: media.year,
        type: media.media_type,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setData(res.data);
      setExpanded(true);
    } catch (e) {
      setError('Could not load TVDB data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const enrich = async () => {
    if (!data) return;
    setSaving(true);
    const updates = {};
    if (data.poster && !media.poster_url) updates.poster_url = data.poster;
    if (data.backdrop && !media.backdrop_url) updates.backdrop_url = data.backdrop;
    if (data.overview && !media.description) updates.description = data.overview;
    if (data.genres?.length && (!media.genre || !media.genre.length)) updates.genre = data.genres;
    if (data.rating && !media.rating) updates.rating = data.rating;
    if (data.seasonCount && !media.season_count) updates.season_count = data.seasonCount;
    if (data.contentRating && !media.content_rating) updates.content_rating = data.contentRating;

    if (Object.keys(updates).length > 0) {
      await base44.entities.Media.update(media.id, updates);
      onEnriched?.(updates);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden mb-6">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Tv2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-foreground">TVDB Metadata</span>
          {data?.rating && (
            <span className="text-xs text-blue-400 font-semibold ml-1">★ {data.rating}</span>
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

      {expanded && data && (
        <div className="px-4 pb-4 pt-2 bg-card/50 space-y-3">
          <div className="flex gap-3">
            {data.poster && (
              <img src={data.poster} alt="poster" className="w-16 h-24 object-cover rounded-lg shrink-0" />
            )}
            <div className="space-y-1.5 min-w-0">
              <p className="text-sm font-semibold text-foreground">{data.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {data.year && <span className="text-xs text-muted-foreground">{data.year}</span>}
                {data.status && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{data.status}</span>}
                {data.contentRating && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{data.contentRating}</span>}
                {data.seasonCount && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{data.seasonCount} seasons</span>}
              </div>
              {data.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.genres.slice(0, 4).map(g => (
                    <span key={g} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
              )}
              {data.overview && (
                <p className="text-xs text-muted-foreground line-clamp-3">{data.overview}</p>
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={enrich}
            disabled={saving || saved}
            className="w-full gap-2"
          >
            {saved ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Metadata saved</>
            ) : saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Fill missing metadata from TVDB</>
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-card/50 text-xs text-muted-foreground">{error}</div>
      )}
    </div>
  );
}