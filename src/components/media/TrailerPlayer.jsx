import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExoPlayer from '@/components/media/ExoPlayer.jsx';

export default function TrailerPlayer({ media, onClose, startAt = 0, onProgress }) {
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If the media has a direct video URL, use native player
    if (media.video_url) {
      setTrailerUrl({ type: 'direct', url: media.video_url });
      return;
    }

    // Otherwise fetch the official trailer from TMDB (search → details → videos)
    let cancelled = false;
    setLoading(true);
    setError(null);

    const tmdbType = media.media_type === 'tv_show' ? 'tv' : 'movie';

    (async () => {
      try {
        const searchRes = await base44.functions.invoke('tmdbLookup', {
          action: 'search',
          query: media.title,
          media_type: tmdbType,
        });
        const results = searchRes.data?.results || [];
        const match =
          (media.year && results.find(r => String(r.year) === String(media.year))) ||
          results.find(r => r.media_type === tmdbType) ||
          results[0];
        if (!match?.tmdb_id) throw new Error('not found');

        const detailsRes = await base44.functions.invoke('tmdbLookup', {
          action: 'details',
          tmdb_id: match.tmdb_id,
          media_type: match.media_type === 'tv' ? 'tv' : 'movie',
        });
        const trailers = detailsRes.data?.trailers || [];
        const key = trailers.map(t => t.key || (t.url || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1]).find(Boolean);
        if (cancelled) return;
        if (key) {
          setTrailerUrl({ type: 'youtube', id: key });
        } else {
          setError('No trailer found for this title.');
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError('No trailer found for this title.'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [media]);

  // Direct video: use the full-featured VideoPlayer
  if (trailerUrl?.type === 'direct') {
    return <ExoPlayer src={trailerUrl.url} title={media.title} onClose={onClose} startAt={startAt} onProgress={onProgress} />;
  }

  // YouTube embed or loading/error state
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl">
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/10 h-10 w-10"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finding trailer…</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center gap-3 text-white">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          )}
          {trailerUrl?.type === 'youtube' && (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${trailerUrl.id}?autoplay=1&rel=0`}
              title={`${media.title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {media.title}{media.year ? ` (${media.year})` : ''}
          {trailerUrl?.type === 'youtube' ? ' — Official Trailer' : ''}
        </p>
      </div>
    </div>
  );
}