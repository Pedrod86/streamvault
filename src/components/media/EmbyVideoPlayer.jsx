import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import dashjs from 'dashjs';
import { X, Layers, Volume2, VolumeX, Maximize, Subtitles, ChevronDown, Play, Pause, SkipBack, SkipForward, PictureInPicture2 } from 'lucide-react';
import PlayerPicker, { PLAYERS } from './PlayerPicker';
import ExternalPlayerView from './ExternalPlayerView';

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function EmbyVideoPlayer({ item, server, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const dashRef = useRef(null);
  const [playerId, setPlayerId] = useState('direct'); // default: Direct Play
  const [showPicker, setShowPicker] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const [codecLabel, setCodecLabel] = useState('');
  const [subtitles, setSubtitles] = useState([]); // { index, label, language }
  const [activeSub, setActiveSub] = useState(-1); // -1 = off
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [pip, setPip] = useState(false);
  const hideTimer = useRef(null);

  const base = server?.server_url?.replace(/\/$/, '') || '';
  const token = server?.api_token || '';

  const hlsUrl = `${base}/Videos/${item.id}/master.m3u8?api_key=${token}&VideoCodec=h264,hevc,av1,vp9&AudioCodec=aac,mp3,ac3,eac3,flac,opus&SubtitleMethod=Encode&TranscodingMaxAudioChannels=2&RequireAvc=false&EnableAdaptiveBitrateStreaming=true&AllowVideoStreamCopy=true&AllowAudioStreamCopy=true&VideoBitDepth=10`;
  const dashUrl = `${base}/Videos/${item.id}/master.mpd?api_key=${token}&VideoCodec=h264,hevc,av1&AudioCodec=aac,ac3,eac3,flac,opus&AllowVideoStreamCopy=true&AllowAudioStreamCopy=true&VideoBitDepth=10&EnableAdaptiveBitrateStreaming=true`;
  const directUrl = `${base}/Videos/${item.id}/stream?api_key=${token}&Static=true`;

  // Fetch subtitle streams from Emby MediaInfo
  useEffect(() => {
    if (!item.id || !base || !token) return;
    fetch(`${base}/Items/${item.id}/PlaybackInfo?api_key=${token}`, {
      headers: { 'X-Emby-Token': token }
    })
      .then(r => r.json())
      .then(data => {
        const streams = data?.MediaSources?.[0]?.MediaStreams || [];
        const subs = streams
          .filter(s => s.Type === 'Subtitle')
          .map((s, i) => ({
            index: s.Index,
            label: s.DisplayTitle || s.Language || `Subtitle ${i + 1}`,
            language: s.Language || '',
          }));
        setSubtitles(subs);
      })
      .catch(() => {});
  }, [item.id, base, token]);

  // PiP events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    return () => { v.removeEventListener('enterpictureinpicture', enter); v.removeEventListener('leavepictureinpicture', leave); };
  }, []);

  // MediaSession API — lock screen / notification controls on Android Chrome
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title || 'StreamVault',
      artist: item.year ? String(item.year) : '',
      artwork: item.posterUrl ? [{ src: item.posterUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    const skip = (offset) => { if (videoRef.current) videoRef.current.currentTime += offset; };
    navigator.mediaSession.setActionHandler('play', () => videoRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => videoRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
    return () => {
      ['play','pause','seekbackward','seekforward'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch(_) {}
      });
    };
  }, [item.title, item.year, item.posterUrl]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const skip = useCallback((secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (pip) await document.exitPictureInPicture?.();
    else await v.requestPictureInPicture?.();
  }, [pip]);

  // Apply subtitle track to video element (for direct/HLS native tracks)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = tracks[i].id === String(activeSub) ? 'showing' : 'hidden';
    }
  }, [activeSub]);

  // Load video source
  useEffect(() => {
    if (['mpv', 'vlc', 'infuse', 'mx'].includes(playerId)) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }

    if (playerId === 'direct') {
      video.src = directUrl;
      video.play().catch(() => {});
      return;
    }

    // DASH mode
    if (playerId === 'dash') {
      const player = dashjs.MediaPlayer().create();
      dashRef.current = player;
      player.initialize(video, dashUrl, true);
      player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
        const tracks = player.getTracksFor('video');
        const hdrTrack = tracks.find(t => t.bitrateList?.some(b => b.height >= 1080));
        if (hdrTrack) player.setCurrentTrack(hdrTrack);
      });
      return;
    }

    // HLS mode
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.FRAG_PARSED, (_e, data) => {
        const codec = data?.frag?.levelCodec || '';
        const level = hls.levels?.[hls.currentLevel];
        const isHdr = level?.videoRange === 'PQ' || level?.videoRange === 'HLG';
        if (codec.includes('hev') || codec.includes('hvc')) setCodecLabel(isHdr ? 'HEVC HDR10+' : 'HEVC');
        else if (codec.includes('av01')) setCodecLabel(isHdr ? 'AV1 HDR10+' : 'AV1');
        else if (codec.includes('vp09')) setCodecLabel('VP9');
        else if (codec.includes('avc') || codec.includes('h264')) setCodecLabel('H264');
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    } else {
      video.src = directUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }
    };
  }, [playerId, hlsUrl, dashUrl, directUrl]);

  // Sync volume to video element (desktop only — mobile OS controls volume hardware)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isMobile) video.volume = volume;
    video.muted = muted;
  }, [volume, muted, isMobile]);

  // Auto-hide controls after 3s of inactivity
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, [showControls]);

  if (['mpv', 'vlc', 'infuse', 'mx'].includes(playerId)) {
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

  const playerLabel = PLAYERS.find(p => p.id === playerId)?.label || 'Direct';
  const activeSubLabel = activeSub === -1 ? 'Off' : subtitles.find(s => s.index === activeSub)?.label || 'On';

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* Top bar — always visible when paused */}
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm font-medium truncate max-w-[200px]">{item.title}</span>
          {codecLabel && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">{codecLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Player picker */}
          <div className="relative">
            <button
              onClick={() => { setShowPicker(p => !p); setShowSubPicker(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" /> {playerLabel}
            </button>
            {showPicker && (
              <PlayerPicker
                current={playerId}
                onChange={(p) => { setPlayerId(p); setShowPicker(false); }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Video — no native controls so our custom controls work on Android */}
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
        onClick={showControls}
      />

      {/* Bottom controls — always visible when paused */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 px-4 pb-safe-bottom pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

        {/* Seek bar */}
        <div className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group mb-3">
          <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full pointer-events-none" style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }} />
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -ml-2 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
          <input type="range" min={0} max={duration || 100} step={0.5} value={currentTime}
            onChange={(e) => { if (videoRef.current) { videoRef.current.currentTime = parseFloat(e.target.value); setCurrentTime(parseFloat(e.target.value)); } }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        </div>

        <div className="flex items-center gap-3">
          {/* Playback controls */}
          <button onClick={() => skip(-10)} className="text-white/80 hover:text-white transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            {playing ? <Pause className="w-5 h-5 fill-white text-white" /> : <Play className="w-5 h-5 fill-white text-white ml-0.5" />}
          </button>
          <button onClick={() => skip(10)} className="text-white/80 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Volume control */}
          <div className="relative flex items-center">
            <button
              onClick={() => isMobile ? setShowVolume(v => !v) : setMuted(m => !m)}
              className="text-white/80 hover:text-white transition-colors"
            >
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {/* Desktop: horizontal slider inline */}
            {!isMobile && (
              <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); }}
                className="ml-2 w-20 accent-primary cursor-pointer" />
            )}
            {/* Mobile: vertical popup slider */}
            {isMobile && showVolume && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-black/90 border border-white/20 rounded-2xl px-3 py-4 z-30">
                <span className="text-white/60 text-[10px]">{muted ? '0' : Math.round(volume * 100)}%</span>
                <input
                  type="range" min={0} max={1} step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); }}
                  className="accent-primary cursor-pointer"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px', width: '28px' }}
                />
                <button onClick={() => setMuted(m => !m)} className="text-white/60 text-[10px] hover:text-white">
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            )}
          </div>

          {/* Time */}
          <span className="text-white/70 text-xs font-mono tabular-nums ml-1 hidden sm:block">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Subtitles picker */}
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowSubPicker(p => !p); setShowPicker(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeSub !== -1 ? 'bg-primary/80 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>{activeSubLabel}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSubPicker && (
                <div className="absolute bottom-10 right-0 w-56 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                    <span className="text-white text-sm font-semibold">Subtitles</span>
                    <button onClick={() => setShowSubPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
                  </div>
                  <div className="p-1.5 space-y-0.5 max-h-60 overflow-y-auto">
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

          {/* PiP */}
          {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
            <button onClick={togglePip} className={`text-white/70 hover:text-white transition-colors ${pip ? 'text-primary' : ''}`}>
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen */}
          <button onClick={() => videoRef.current?.requestFullscreen?.()} className="text-white/70 hover:text-white transition-colors">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}