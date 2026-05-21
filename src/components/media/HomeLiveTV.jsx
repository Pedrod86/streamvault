import React, { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, Play, X, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLiveStreams, getLiveStreamUrl } from '@/lib/xtreamApi';
import Hls from 'hls.js';

function LiveChannelCard({ item, onPlay }) {
  return (
    <div
      className="cursor-pointer group shrink-0 w-[120px] sm:w-[140px] flex flex-col"
      onClick={() => onPlay(item)}
    >
      <div className="relative rounded-xl overflow-hidden bg-secondary aspect-video mb-1.5 flex items-center justify-center">
        {item.stream_icon ? (
          <img
            src={item.stream_icon}
            alt={item.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <Radio className="w-6 h-6 text-muted-foreground/40" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </div>
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-500/90 text-white">LIVE</span>
        </div>
      </div>
      <p className="text-[11px] text-foreground font-medium truncate leading-tight">{item.name}</p>
    </div>
  );
}

function IptvPlayerOverlay({ url, title, onClose }) {
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Try HLS.js first (for .ts / m3u8 streams)
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          // Fallback: try direct src
          hls.destroy();
          hlsRef.current = null;
          video.src = url;
          video.play().catch(() => {});
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      video.src = url;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/80 text-sm font-medium truncate max-w-[60vw]">{title}</span>
        <div className="w-8" />
      </div>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        controls
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
      />
    </div>
  );
}

export default function HomeLiveTV() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(null);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  const xtreamServer = servers.find(s => s.server_type === 'xtream');

  useEffect(() => {
    if (!xtreamServer) return;
    let cancelled = false;
    setLoading(true);
    getLiveStreams(xtreamServer)
      .then(data => { if (!cancelled) setStreams(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [xtreamServer?.id]);

  const handlePlay = useCallback((item) => {
    const url = getLiveStreamUrl(xtreamServer, item.stream_id, 'ts');
    setPlaying({ url, name: item.name });
  }, [xtreamServer]);

  if (!xtreamServer) return null;

  // Show first 20 channels
  const preview = streams.slice(0, 20);

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="font-heading font-bold text-base text-foreground">Live TV</h2>
          </div>
          <Link
            to="/iptv"
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading && (
          <div className="flex gap-3 px-4 sm:px-6">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <div className="bg-secondary rounded-xl aspect-video mb-1.5 animate-pulse" />
                <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        )}

        {!loading && preview.length > 0 && (
          <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
            {preview.map(item => (
              <LiveChannelCard key={item.stream_id || item.num} item={item} onPlay={handlePlay} />
            ))}
          </div>
        )}
      </div>

      {playing && (
        <IptvPlayerOverlay url={playing.url} title={playing.name} onClose={() => setPlaying(null)} />
      )}
    </>
  );
}