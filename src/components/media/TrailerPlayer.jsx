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

    // Otherwise look up a YouTube trailer via AI web search
    let cancelled = false;
    setLoading(true);
    setError(null);

    base44.integrations.Core.InvokeLLM({
      prompt: `Find the official YouTube trailer for "${media.title}" (${media.year || ''}) ${media.media_type === 'tv_show' ? 'TV show' : 'movie'}.
Return ONLY a JSON object with a single field "youtube_id" containing the 11-character YouTube video ID.
If you cannot find one, set youtube_id to null.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: { youtube_id: { type: ['string', 'null'] } }
      }
    }).then(res => {
      if (cancelled) return;
      if (res?.youtube_id) {
        setTrailerUrl({ type: 'youtube', id: res.youtube_id });
      } else {
        setError('No trailer found for this title.');
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError('Could not load trailer.'); setLoading(false); }
    });

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
          {trailerUrl?.type === 'youtube' ? ' — Official Trailer via YouTube' : ''}
        </p>
      </div>
    </div>
  );
}