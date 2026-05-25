import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronDown, Tv2, Subtitles } from 'lucide-react';
import { PLAYERS } from './PlayerPicker';
import ExternalPlayerView from './ExternalPlayerView';

// ── Emby session reporter ────────────────────────────────────────────────────
function useEmbyPlaybackReporter({ base, token, itemId, getCurrentTime }) {
  const sessionId = useRef(`streamvault-${Date.now()}`);
  const reported = useRef(false);
  const interval = useRef(null);
  const [playing, setPlaying] = useState(false);

  const report = useCallback((endpoint, extra = {}) => {
    if (!base || !token || !itemId) return;
    fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'X-Emby-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ItemId: itemId,
        SessionId: sessionId.current,
        PositionTicks: Math.floor((getCurrentTime() || 0) * 10_000_000),
        IsPaused: false,
        IsMuted: false,
        ...extra,
      }),
    }).catch(() => {});
  }, [base, token, itemId, getCurrentTime]);

  useEffect(() => {
    if (playing && !reported.current) {
      reported.current = true;
      report('/Sessions/Playing');
    }
  }, [playing, report]);

  useEffect(() => {
    if (playing) {
      interval.current = setInterval(() => report('/Sessions/Playing/Progress', { IsPaused: false }), 10_000);
    } else {
      clearInterval(interval.current);
      if (reported.current) report('/Sessions/Playing/Progress', { IsPaused: true });
    }
    return () => clearInterval(interval.current);
  }, [playing, report]);

  useEffect(() => {
    return () => {
      clearInterval(interval.current);
      if (reported.current) report('/Sessions/Playing/Stopped');
    };
  }, [report]);

  return { setPlaying };
}

// ── CDN loader helper ────────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.id = id; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadLink(href, id) {
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href; l.id = id;
  document.head.appendChild(l);
}

// ── Main component ───────────────────────────────────────────────────────────
export default function EmbyVideoPlayer({ item, server, onClose, initialPlayerId }) {
  const [playerId, setPlayerId] = useState(initialPlayerId || 'videojs');
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [activeSub, setActiveSub] = useState(-1);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [audioCodecLabel, setAudioCodecLabel] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const getCurrentTimeRef = useRef(() => 0);

  const base = server?.server_url?.replace(/\/$/, '') || '';
  const token = server?.api_token || '';

  const subParam = activeSub !== -1 ? `&SubtitleStreamIndex=${activeSub}&SubtitleMethod=Encode` : '';
  const hlsUrl = `${base}/Videos/${item.id}/master.m3u8?api_key=${token}&VideoCodec=h264,hevc,av1,vp9&AudioCodec=aac,mp3&RequireAvc=false&EnableAdaptiveBitrateStreaming=true&AllowVideoStreamCopy=true&AllowAudioStreamCopy=false&VideoBitDepth=10&AudioBitRate=320000&MediaSourceId=${item.id}${subParam}`;
  const dashUrl = `${base}/Videos/${item.id}/master.mpd?api_key=${token}&VideoCodec=h264,hevc,av1&AudioCodec=aac&AllowVideoStreamCopy=true&AllowAudioStreamCopy=false&VideoBitDepth=10&EnableAdaptiveBitrateStreaming=true&AudioBitRate=320000&MediaSourceId=${item.id}`;

  const { setPlaying } = useEmbyPlaybackReporter({
    base, token, itemId: item?.id,
    getCurrentTime: useCallback(() => getCurrentTimeRef.current(), []),
  });

  // Fetch subtitle streams + audio info
  useEffect(() => {
    if (!item.id || !base || !token) return;
    fetch(`${base}/Items/${item.id}/PlaybackInfo?api_key=${token}`, {
      headers: { 'X-Emby-Token': token }
    }).then(r => r.json()).then(data => {
      const streams = data?.MediaSources?.[0]?.MediaStreams || [];
      setSubtitles(streams.filter(s => s.Type === 'Subtitle').map((s, i) => ({
        index: s.Index,
        label: s.DisplayTitle || s.Language || `Subtitle ${i + 1}`,
      })));
      const audio = streams.find(s => s.Type === 'Audio');
      if (audio) {
        const codec = (audio.Codec || '').toUpperCase();
        const ch = audio.Channels ? ` ${audio.Channels}ch` : '';
        setAudioCodecLabel(`${codec}${ch} → AAC`);
      }
    }).catch(() => {});
  }, [item.id, base, token]);

  // Destroy previous player instance
  const destroyPlayer = useCallback(() => {
    const inst = playerInstanceRef.current;
    if (!inst) return;
    try {
      if (typeof inst.dispose === 'function') inst.dispose();
      else if (typeof inst.destroy === 'function') inst.destroy();
      else if (typeof inst.reset === 'function') inst.reset();
    } catch (_) {}
    playerInstanceRef.current = null;
  }, []);

  // ── Init selected player ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    setError(null);
    destroyPlayer();

    // Clear container
    containerRef.current.innerHTML = '';

    const external = ['mpv', 'vlc', 'infuse', 'mx', 'moviplayer', 'onlineplayer'];
    if (external.includes(playerId)) { setReady(true); return; }

    if (playerId === 'videojs') initVideoJs();
    else if (playerId === 'plyr') initPlyr();
    else if (playerId === 'shaka') initShaka();
    else if (playerId === 'mediaelement') initMediaElement();

    return () => destroyPlayer();
  }, [playerId, hlsUrl, dashUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video.js ──────────────────────────────────────────────────────────────
  async function initVideoJs() {
    try {
      loadLink('https://vjs.zencdn.net/8.10.0/video-js.css', 'vjs-css');
      await loadScript('https://vjs.zencdn.net/8.10.0/video.min.js', 'vjs-js');
      await loadScript('https://cdn.jsdelivr.net/npm/videojs-contrib-hls@5.15.0/dist/videojs-contrib-hls.min.js', 'vjs-hls');

      const el = document.createElement('video');
      el.className = 'video-js vjs-default-skin vjs-big-play-centered';
      el.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
      containerRef.current.appendChild(el);

      const player = window.videojs(el, {
        controls: true,
        autoplay: true,
        preload: 'auto',
        fluid: false,
        fill: true,
        sources: [{ src: hlsUrl, type: 'application/x-mpegURL' }],
      });

      player.on('play', () => setPlaying(true));
      player.on('pause', () => setPlaying(false));
      player.on('error', () => setError('Video.js: stream failed to load'));
      getCurrentTimeRef.current = () => player.currentTime() || 0;
      playerInstanceRef.current = player;
      setReady(true);
    } catch (e) {
      setError('Failed to load Video.js: ' + e.message);
    }
  }

  // ── Plyr ──────────────────────────────────────────────────────────────────
  async function initPlyr() {
    try {
      loadLink('https://cdn.plyr.io/3.7.8/plyr.css', 'plyr-css');
      await loadScript('https://cdn.plyr.io/3.7.8/plyr.polyfilled.js', 'plyr-js');
      await loadScript('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js', 'plyr-hlsjs');

      const video = document.createElement('video');
      video.style.cssText = 'width:100%;height:100%;';
      video.setAttribute('playsinline', '');
      containerRef.current.appendChild(video);

      const Hls = window.Hls;
      let hlsInstance = null;
      if (Hls && Hls.isSupported()) {
        hlsInstance = new Hls();
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.attachMedia(video);
      } else {
        video.src = hlsUrl;
      }

      const player = new window.Plyr(video, {
        controls: ['play-large', 'play', 'rewind', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'],
        autoplay: true,
      });

      player.on('play', () => setPlaying(true));
      player.on('pause', () => setPlaying(false));
      getCurrentTimeRef.current = () => video.currentTime || 0;

      // Store both so we can destroy both
      playerInstanceRef.current = {
        dispose: () => { player.destroy(); hlsInstance?.destroy(); }
      };
      setReady(true);
    } catch (e) {
      setError('Failed to load Plyr: ' + e.message);
    }
  }

  // ── Shaka Player ──────────────────────────────────────────────────────────
  async function initShaka() {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/shaka-player@4.7.11/dist/shaka-player.compiled.js', 'shaka-js');
      loadLink('https://cdn.jsdelivr.net/npm/shaka-player@4.7.11/dist/controls.css', 'shaka-css');

      const video = document.createElement('video');
      video.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;';
      video.setAttribute('playsinline', '');
      video.controls = true;
      containerRef.current.appendChild(video);

      window.shaka.polyfill.installAll();
      if (!window.shaka.Player.isBrowserSupported()) {
        setError('Shaka Player is not supported in this browser');
        return;
      }

      const player = new window.shaka.Player(video);
      player.addEventListener('error', (e) => setError('Shaka: ' + (e.detail?.message || 'stream error')));

      // Try HLS first, fallback to DASH
      await player.load(hlsUrl).catch(() => player.load(dashUrl));
      video.play().catch(() => {});
      video.addEventListener('play', () => setPlaying(true));
      video.addEventListener('pause', () => setPlaying(false));
      getCurrentTimeRef.current = () => video.currentTime || 0;
      playerInstanceRef.current = player;
      setReady(true);
    } catch (e) {
      setError('Failed to load Shaka Player: ' + e.message);
    }
  }

  // ── MediaElement.js ───────────────────────────────────────────────────────
  async function initMediaElement() {
    try {
      loadLink('https://cdn.jsdelivr.net/npm/mediaelement@6.0.3/build/mediaelementplayer.min.css', 'mejs-css');
      await loadScript('https://cdn.jsdelivr.net/npm/mediaelement@6.0.3/build/mediaelement-and-player.min.js', 'mejs-js');

      const video = document.createElement('video');
      video.style.cssText = 'width:100%;height:100%;';
      video.setAttribute('playsinline', '');
      video.src = hlsUrl;
      containerRef.current.appendChild(video);

      const player = new window.MediaElementPlayer(video, {
        stretching: 'fill',
        hls: { withCredentials: false },
        success: (mediaElement) => {
          mediaElement.addEventListener('play', () => setPlaying(true));
          mediaElement.addEventListener('pause', () => setPlaying(false));
          getCurrentTimeRef.current = () => mediaElement.currentTime || 0;
          mediaElement.play();
        },
        error: () => setError('MediaElement.js: stream failed to load'),
      });

      playerInstanceRef.current = {
        dispose: () => { try { player.remove(); } catch(_) {} }
      };
      setReady(true);
    } catch (e) {
      setError('Failed to load MediaElement.js: ' + e.message);
    }
  }

  const playerLabel = PLAYERS.find(p => p.id === playerId)?.label || playerId;
  const external = ['mpv', 'vlc', 'infuse', 'mx', 'moviplayer', 'onlineplayer'];

  if (external.includes(playerId)) {
    return (
      <ExternalPlayerView
        item={item}
        server={server}
        playerId={playerId}
        onClose={onClose}
        onSwitchPlayer={setPlayerId}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 to-transparent">
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm font-medium truncate max-w-[180px]">{item.title}</span>
          {audioCodecLabel && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">{audioCodecLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-2 relative">
          {/* Subtitle picker */}
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSubPicker(p => !p)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${activeSub !== -1 ? 'bg-primary/80 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSubPicker && (
                <div className="absolute top-9 right-0 w-52 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-30">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                    <span className="text-white text-sm font-semibold">Subtitles</span>
                    <button onClick={() => setShowSubPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
                  </div>
                  <div className="p-1.5 max-h-56 overflow-y-auto">
                    <button onClick={() => { setActiveSub(-1); setShowSubPicker(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSub === -1 ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}>
                      Off
                    </button>
                    {subtitles.map(s => (
                      <button key={s.index} onClick={() => { setActiveSub(s.index); setShowSubPicker(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSub === s.index ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Player picker */}
          <button
            onClick={() => setShowPlayerPicker(p => !p)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors text-[10px] font-bold uppercase"
          >
            <Tv2 className="w-3.5 h-3.5" />
            {playerLabel}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showPlayerPicker && (
            <div className="absolute top-9 right-0 w-64 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-30">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <span className="text-white text-sm font-semibold">Choose Player</span>
                <button onClick={() => setShowPlayerPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
              </div>
              <div className="p-1.5 max-h-72 overflow-y-auto">
                {PLAYERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPlayerId(p.id); setShowPlayerPicker(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${playerId === p.id ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}
                  >
                    <div className="font-medium">{p.label}</div>
                    {p.description && <div className="text-[10px] text-white/40 mt-0.5">{p.description}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 gap-4 px-6 text-center">
          <p className="text-white/70 text-sm">{error}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {PLAYERS.filter(p => !['mpv','vlc','infuse','mx'].includes(p.id)).map(p => (
              <button key={p.id} onClick={() => setPlayerId(p.id)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20">
                Try {p.label}
              </button>
            ))}
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-destructive/20 text-destructive text-sm font-medium">Close</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
            <span className="text-white/50 text-sm">Loading {playerLabel}…</span>
          </div>
        </div>
      )}

      {/* Player mount point */}
      <div
        ref={containerRef}
        className="w-full h-full relative"
        style={{ background: '#000' }}
      />
    </div>
  );
}