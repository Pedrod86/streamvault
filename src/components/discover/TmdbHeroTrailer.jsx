import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Extracts the 11-char YouTube ID from a trailer URL
function youtubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function TmdbHeroTrailer({ trailers, backdrop }) {
  const [muted, setMuted] = useState(true);
  const [show, setShow] = useState(false);
  const [failed, setFailed] = useState(false);

  const id = (trailers || []).map(t => youtubeId(t.url)).find(Boolean);

  // Small delay so the backdrop image shows first, then trailer fades in
  useEffect(() => {
    setShow(false);
    setFailed(false);
    if (!id) return;
    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, [id]);

  const playing = id && show && !failed;

  return (
    <>
      {backdrop && (
        <img src={backdrop} alt="" className="w-full h-full object-cover" />
      )}
      {playing && (
        <iframe
          className="absolute inset-0 w-full h-full pointer-events-none"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${id}`}
          title="Trailer"
          allow="autoplay; encrypted-media"
          onError={() => setFailed(true)}
        />
      )}
      {playing && (
        <button
          onClick={() => setMuted(m => !m)}
          className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}
    </>
  );
}