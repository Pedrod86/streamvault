import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import dashjs from 'dashjs';
import { X, Volume2, VolumeX, Maximize, Minimize, Subtitles, ChevronDown, Play, Pause, SkipBack, SkipForward, PictureInPicture2 } from 'lucide-react';
import { PLAYERS } from './PlayerPicker';
import ExternalPlayerView from './ExternalPlayerView';

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function EmbyVideoPlayer({ item, server, onClose, initialPlayerId, initialSubtitleIndex }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const dashRef = useRef(null);
  const [playerId, setPlayerId] = useState(initialPlayerId || 'direct');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Always show inline controls regardless of device type
  const [codecLabel, setCodecLabel] = useState('');
  const [audioCodecLabel, setAudioCodecLabel] = useState('');
  const [subtitles, setSubtitles] = useState([]); // { index, label, language }
  const [activeSub, setActiveSub] = useState(initialSubtitleIndex ?? -1); // -1 = off
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

  const subParam = activeSub !== -1 ? `&SubtitleStreamIndex=${activeSub}&SubtitleMethod=Encode` : '';
  // HLS: always transcode audio to AAC so browsers can decode AC3/EAC3/DTS/TrueHD
  const hlsUrl = `${base}/Videos/${item.id}/master.m3u8?api_key=${token}&VideoCodec=h264,hevc,av1,vp9&AudioCodec=aac${subParam}&RequireAvc=false&EnableAdaptiveBitrateStreaming=true&AllowVideoStreamCopy=true&AllowAudioStreamCopy=false&VideoBitDepth=10&AudioBitRate=320000&TranscodeReasons=AudioCodecNotSupported`;
  const dashUrl = `${base}/Videos/${item.id}/master.mpd?api_key=${token}&VideoCodec=h264,hevc,av1&AudioCodec=aac&AllowVideoStreamCopy=true&AllowAudioStreamCopy=false&VideoBitDepth=10&EnableAdaptiveBitrateStreaming=true&AudioBitRate=320000`;
  // Direct: force audio transcode to AAC — critical for AC3/EAC3/DTS/TrueHD which browsers cannot decode
  const directUrl = `${base}/Videos/${item.id}/stream?api_key=${token}&Static=false&AudioCodec=aac&VideoCodec=h264,hevc,av1,vp9&AllowVideoStreamCopy=true&AllowAudioStreamCopy=false&AudioBitRate=320000&TranscodeReasons=AudioCodecNotSupported`;

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
        // Show original audio codec so user knows why transcoding is happening
        const audioStream = streams.find(s => s.Type === 'Audio');
        if (audioStream) {
          const codec = (audioStream.Codec || '').toUpperCase();
          const channels = audioStream.Channels ? ` ${audioStream.Channels}ch` : '';
          setAudioCodecLabel(`${codec}${channels} → AAC`);
        }
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

  // When subtitle changes, reload HLS/DASH stream with new subtitle index baked in
  // (direct play doesn't transcode so subtitle switching isn't applicable there)
  const savedPosRef = useRef(0);
  useEffect(() => {
    if (playerId === 'direct' || ['mpv', 'vlc', 'infuse', 'mx'].includes(playerId)) return;
    const video = videoRef.current;
    if (!video) return;
    savedPosRef.current = video.currentTime || 0;
    // Destroy existing players — the source useEffect will pick up the new hlsUrl
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }

    if (playerId === 'dash') {
      // Rebuild dash with updated url
      const player = dashjs.MediaPlayer().create();
      dashRef.current = player;
      player.initialize(video, dashUrl, true);
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        if (savedPosRef.current > 2) player.seek(savedPosRef.current);
      });
      return;
    }
    // HLS
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (savedPosRef.current > 2) video.currentTime = savedPosRef.current;
        video.play().catch(() => {});
      });
    } else {
      video.src = hlsUrl;
      video.onloadedmetadata = () => {
        if (savedPosRef.current > 2) video.currentTime = savedPosRef.current;
        video.play().catch(() => {});
      };
    }
  }, [activeSub]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load video source
  useEffect(() => {
    if (['mpv', 'vlc', 'infuse', 'mx'].includes(playerId)) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (dashRef.current) { dashRef.current.destroy(); dashRef.current = null; }

    if (playerId === 'direct') {
      video.src = directUrl;
      video.load();
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
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch((_e) => {}); });
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

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const fn = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = document.querySelector('.emby-player-container') || document.documentElement;
    if (!fullscreen) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, [fullscreen]);

  // Sync volume to video element — works on ALL devices including Android TV
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Try to set volume — some browsers/WebViews ignore this but it never hurts to try
    try { video.volume = muted ? 0 : volume; } catch (_) {}
    video.muted = muted;
  }, [volume, muted]);

  // Auto-hide controls after 3s of inactivity
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 5000);
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
      className="emby-player-container fixed inset-0 z-50 bg-black flex flex-col"
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
          {audioCodecLabel && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">{audioCodecLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/50 uppercase">{playerLabel}</span>
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
        onError={() => {}}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onClick={() => {
          if (!controlsVisible) {
            showControls();
          } else {
            togglePlay();
            showControls();
          }
        }}
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

          {/* Volume control — always inline */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMuted(m => !m)}
              className="text-white/80 hover:text-white transition-colors"
            >
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
              onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setMuted(v === 0); }}
              className="ml-1 w-20 accent-primary cursor-pointer" />
          </div>

          {/* Time */}
          <span className="text-white/70 text-xs font-mono tabular-nums ml-1 hidden sm:block">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Subtitles / CC picker — always shown */}
          <div className="relative">
            <button
              onClick={() => { setShowSubPicker(p => !p); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeSub !== -1 ? 'bg-primary/80 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title="Subtitles / CC"
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{activeSubLabel}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSubPicker && (
              <div className="absolute bottom-10 right-0 w-56 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                  <span className="text-white text-sm font-semibold">Subtitles / CC</span>
                  <button onClick={() => setShowSubPicker(false)} className="text-white/50 hover:text-white text-xs">✕</button>
                </div>
                <div className="p-1.5 space-y-0.5 max-h-60 overflow-y-auto">
                  <button onClick={() => { setActiveSub(-1); setShowSubPicker(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSub === -1 ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}>
                    Off
                  </button>
                  {subtitles.length === 0 && (
                    <p className="text-white/40 text-xs px-3 py-2">No subtitle tracks found</p>
                  )}
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

          {/* PiP */}
          {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
            <button onClick={togglePip} className={`text-white/70 hover:text-white transition-colors ${pip ? 'text-primary' : ''}`}>
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen toggle */}
          <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}