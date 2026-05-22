import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { base44 } from '@/api/base44Client';
import { X, Maximize, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function IptvDetailPlayer({ url, title, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (playing) resetHideTimer();
    else { clearTimeout(hideTimer.current); setShowControls(true); }
    return () => clearTimeout(hideTimer.current);
  }, [playing, resetHideTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetHideTimer();
  };

  const skip = (secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
    resetHideTimer();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    async function start() {
      if (!url.includes('.m3u8')) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      if (!Hls.isSupported()) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      let playlistText = null;
      try {
        const res = await base44.functions.invoke('streamProxy', { url });
        playlistText = res?.data?.content;
      } catch (_) {}

      if (!playlistText) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const rewritten = playlistText.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `proxy::${absUrl}`;
      }).join('\n');

      const DefaultLoader = Hls.DefaultConfig.loader;
      class ProxyLoader extends DefaultLoader {
        load(context, config, callbacks) {
          if (context.url.startsWith('proxy::')) {
            const realUrl = context.url.slice(7);
            base44.functions.invoke('streamProxy', { url: realUrl }).then(res => {
              const content = res?.data?.content;
              if (content) {
                callbacks.onSuccess({ data: content, url: context.url }, { code: 200, text: '' }, context);
              } else {
                callbacks.onError({ code: 0, text: 'proxy error' }, context, null);
              }
            }).catch(() => callbacks.onError({ code: 0, text: 'proxy error' }, context, null));
          } else {
            super.load(context, config, callbacks);
          }
        }
      }

      const blob = new Blob([rewritten], { type: 'application/vnd.apple.mpegurl' });
      const blobUrl = URL.createObjectURL(blob);
      const hls = new Hls({ enableWorker: false, loader: ProxyLoader });
      hlsRef.current = hls;
      hls.loadSource(blobUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    }

    start();
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/80 text-sm font-medium truncate max-w-[200px]">{title}</span>
        <button onClick={() => videoRef.current?.requestFullscreen?.()} className="text-white/70 hover:text-white p-1">
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onClick={togglePlay}
      />

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

        {/* Seek bar */}
        <div className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group mb-3">
          <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full pointer-events-none" style={{ width: `${bufferedPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -ml-2 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
            style={{ left: `${progress}%` }} />
          <input type="range" min={0} max={duration || 100} step={0.5} value={currentTime}
            onChange={(e) => { const v = videoRef.current; if (v) { v.currentTime = parseFloat(e.target.value); setCurrentTime(parseFloat(e.target.value)); } }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </div>

        <div className="flex items-center gap-3">
          {/* Playback */}
          <button onClick={() => skip(-10)} className="text-white/80 hover:text-white transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            {playing ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white ml-0.5" />}
          </button>
          <button onClick={() => skip(10)} className="text-white/80 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Volume */}
          <button onClick={() => setMuted(m => !m)} className="text-white/80 hover:text-white transition-colors">
            {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
            onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0) setMuted(false); }}
            className="w-20 accent-primary cursor-pointer hidden sm:block" />

          {/* Time */}
          <span className="text-white/70 text-xs font-mono tabular-nums ml-1">
            {formatTime(currentTime)}{duration > 0 ? ` / ${formatTime(duration)}` : ''}
          </span>

          <div className="flex-1" />

          <button onClick={() => videoRef.current?.requestFullscreen?.()} className="text-white/70 hover:text-white transition-colors">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}