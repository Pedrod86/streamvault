import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

// Extracts the 11-char YouTube ID from a trailer URL
function youtubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function TmdbHeroTrailer({ trailers, backdrop }) {
  const [playing, setPlaying] = useState(false);

  const id = (trailers || []).map(t => youtubeId(t.url)).find(Boolean);

  // Reset when navigating between titles
  useEffect(() => { setPlaying(false); }, [id]);

  return (
    <>
      {backdrop && (
        <img src={backdrop} alt="" className="w-full h-full object-cover" />
      )}

      {playing && id && (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title="Trailer"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Play button overlay — user taps to start the trailer (avoids autoplay errors) */}
      {!playing && id && (
        <button
          onClick={() => setPlaying(true)}
          className="absolute inset-0 z-10 flex items-center justify-center group"
        >
          <span className="w-14 h-14 rounded-full bg-black/50 group-hover:bg-primary/80 flex items-center justify-center transition-colors backdrop-blur-sm">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </span>
        </button>
      )}
    </>
  );
}