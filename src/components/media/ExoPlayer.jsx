import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { usePlaybackWatchdog } from '@/hooks/usePlaybackWatchdog';
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, PictureInPicture2,
  ChevronLeft, ChevronRight, Wifi, Layers, AudioLines,
  Subtitles, Info, Gauge
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('sv_player_prefs') || '{}'); } catch { return {}; }
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// On touch devices the OS controls volume via hardware buttons and rejects
// programmatic volume changes (slider snaps back), so hide the on-screen slider.
const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

// If a direct Emby stream can't be decoded by the browser (e.g. MKV), build the
// HLS transcode URL so the single player can fall back without any caller changes.
// Emby requires the real MediaSourceId (mediasource_<itemId>) plus a DeviceId and
// PlaySessionId — without them the master.m3u8 request returns HTTP 400.
function toEmbyHlsTranscode(directUrl) {
  const m = directUrl.match(/^(.*)\/Videos\/([^/]+)\/stream/);
  if (!m) return null;
  const [, base, id] = m;
  const token = directUrl.match(/[?&]api_key=([^&]+)/)?.[1] || '';
  return `${base}/Videos/${id}/master.m3u8?api_key=${token}` +
    `&MediaSourceId=mediasource_${id}&DeviceId=streamvault-web&PlaySessionId=${Date.now()}` +
    `&VideoCodec=h264&AudioCodec=aac,mp3&TranscodingContainer=ts&TranscodingProtocol=hls` +
    `&EnableAdaptiveBitrateStreaming=true`;
}

function Btn({ children, onClick, title: tip }) {
  return (
    <button
      title={tip}
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
    >
      {children}
    </button>
  );
}

// ── HLS config tuned for reliable relay / mobile playback ─────────────────────
const HLS_CONFIG = {
  // Larger forward buffer so brief network dips during relay don't cause stalls
  maxBufferLength: 60,
  maxMaxBufferLength: 180,
  maxBufferSize: 80 * 1000 * 1000, // 80 MB
  maxBufferHole: 0.5,
  // Jump small gaps automatically instead of stalling
  nudgeOffset: 0.2,
  nudgeMaxRetry: 8,
  highBufferWatchdogPeriod: 2,
  // Start conservatively (auto ABR picks up quickly) so playback begins fast
  startLevel: -1,
  // Conservative ABR — react to weak mobile networks, recover quality gradually.
  // Lower up-factor avoids over-shooting bitrate on flaky connections.
  abrEwmaDefaultEstimate: 500000,
  abrEwmaFastLive: 3,
  abrEwmaSlowLive: 9,
  abrBandWidthFactor: 0.9,
  abrBandWidthUpFactor: 0.6,
  abrMaxWithRealBitrate: true,
  // Aggressive retry counts/timeouts for unreliable relay connections
  manifestLoadingMaxRetry: 8,
  manifestLoadingRetryDelay: 1000,
  manifestLoadingMaxRetryTimeout: 64000,
  levelLoadingMaxRetry: 8,
  levelLoadingRetryDelay: 1000,
  fragLoadingMaxRetry: 10,
  fragLoadingRetryDelay: 1000,
  fragLoadingMaxRetryTimeout: 64000,
  // Faster switching
  appendErrorMaxRetry: 5,
  enableWorker: true,
  lowLatencyMode: false,
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ExoPlayer({ src, title, onClose, onProgress, startAt = 0 }) {
  const prefs = loadPrefs();
  const skipSecs = parseInt(prefs.skipSeconds || '10', 10);
  const fitMode = prefs.fitMode || 'contain';
  const initVol = parseFloat(prefs.defaultVolume || '1');

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);
  const lastSaved = useRef(0);
  const seekBarRef = useRef(null);
  const lastTap = useRef(0);
  const triedHlsFallback = useRef(false);

  // The URL currently loaded — may switch from a direct stream to an HLS transcode on error
  const [activeSrc, setActiveSrc] = useState(src);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(initVol);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(parseFloat(prefs.speed || '1'));
  const [seekPreview, setSeekPreview] = useState(null);
  const [tapFlash, setTapFlash] = useState(null);
  const [pip, setPip] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [fatalError, setFatalError] = useState(null);

  // Settings panel tabs: 'speed' | 'quality' | 'audio'
  const [settingsTab, setSettingsTab] = useState(null);

  // HLS track info
  const [qualityLevels, setQualityLevels] = useState([]); // { index, label, bitrate }
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [audioTracks, setAudioTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [isHls, setIsHls] = useState(false);

  // Subtitle tracks
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(-1); // -1 = off

  // A/V sync offset (seconds, applied via audio delay simulation)
  const [avOffset, setAvOffset] = useState(0);

  // Codec / HDR info
  const [codecInfo, setCodecInfo] = useState(null); // { video, audio, hdr, container, resolution }
  const [isHdr, setIsHdr] = useState(false);

  // ── playback reliability: frozen-buffer watchdog + network reconnect ────────
  usePlaybackWatchdog({ videoRef, hlsRef, playing, onBuffering: setIsBuffering });

  // ── controls visibility ────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setSettingsTab(null);
    }, 3500);
  }, []);

  useEffect(() => {
    if (playing) resetHideTimer();
    else { clearTimeout(hideTimer.current); setShowControls(true); }
    return () => clearTimeout(hideTimer.current);
  }, [playing, resetHideTimer]);

  // ── fullscreen & pip ───────────────────────────────────────────────────────

  useEffect(() => {
    const fn = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    return () => { v.removeEventListener('enterpictureinpicture', enter); v.removeEventListener('leavepictureinpicture', leave); };
  }, []);

  // ── HLS.js setup ──────────────────────────────────────────────────────────

  // Reset fallback tracking whenever the caller passes a new source
  useEffect(() => {
    triedHlsFallback.current = false;
    setFatalError(null);
    setActiveSrc(src);
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeSrc) return;
    const src = activeSrc;

    const isHlsSrc = /\.(m3u8|m3u)/i.test(src) || src.includes('m3u8');

    if (isHlsSrc && Hls.isSupported()) {
      setIsHls(true);
      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        // Build quality levels list
        const levels = data.levels.map((l, i) => ({
          index: i,
          label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}kbps`,
          bitrate: l.bitrate || 0,
          height: l.height || 0,
        }));
        // Sort highest quality first
        levels.sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setCurrentQuality(-1); // auto by default

        // Audio tracks
        const aTracks = hls.audioTracks.map((t, i) => ({ index: i, label: t.name || t.lang || `Track ${i + 1}` }));
        setAudioTracks(aTracks);
        setCurrentAudio(hls.audioTrack);

        // Subtitle tracks from HLS manifest
        const sTracks = hls.subtitleTracks.map((t, i) => ({ index: i, label: t.name || t.lang || `Sub ${i + 1}` }));
        setSubtitleTracks(sTracks);

        // Codec info from highest quality level
        const topLevel = data.levels[0];
        if (topLevel) {
          const vCodec = topLevel.videoCodec || '';
          const aCodec = topLevel.audioCodec || '';
          const hdr = !!(topLevel.videoRange && topLevel.videoRange !== 'SDR');
          setIsHdr(hdr);
          setCodecInfo({
            video: vCodec ? vCodec.split('.')[0].toUpperCase() : 'Unknown',
            audio: aCodec ? aCodec.split('.')[0].toUpperCase() : 'Unknown',
            hdr,
            hdrType: topLevel.videoRange || 'SDR',
            container: 'HLS',
            resolution: topLevel.width && topLevel.height ? `${topLevel.width}×${topLevel.height}` : null,
          });
        }

        v.volume = initVol;
        if (startAt > 0) v.currentTime = startAt;
        v.play().catch(() => {});
      });

      // Track ABR switches
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        if (hls.autoLevelEnabled) setCurrentQuality(-1);
        else setCurrentQuality(data.level);
      });

      // Stall / network recovery with escalating backoff. Relay connections drop
      // often, so we keep retrying rather than failing the playback outright.
      let recoverCount = 0;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Back off a touch before resuming the load — avoids hammering a dropped relay
          const delay = Math.min(1000 * Math.pow(2, recoverCount), 8000);
          recoverCount = Math.min(recoverCount + 1, 4);
          setIsBuffering(true);
          // After several failed network retries, surface an error instead of a blank screen
          if (recoverCount >= 4) {
            setFatalError('This episode could not be streamed. The server may be offline or the format is unsupported.');
            setIsBuffering(false);
          }
          setTimeout(() => { try { hls.startLoad(); } catch (_) {} }, delay);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch (_) {}
        } else {
          // Unrecoverable type — full teardown + reload as a last resort
          try {
            hls.destroy();
            const fresh = new Hls(HLS_CONFIG);
            hlsRef.current = fresh;
            fresh.loadSource(src);
            fresh.attachMedia(v);
          } catch (_) {}
        }
      });

      // Reset the recovery counter once we're playing smoothly again
      hls.on(Hls.Events.FRAG_BUFFERED, () => { recoverCount = 0; });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Native playback (MP4, native HLS on Safari, etc.)
      setIsHls(false);
      v.src = src;
      v.volume = initVol;

      // Detect container from URL extension
      const ext = src.split('?')[0].split('.').pop()?.toUpperCase() || 'MP4';
      setCodecInfo(prev => ({ ...prev, container: ext }));

      v.addEventListener('loadedmetadata', () => {
        if (startAt > 0 && startAt < v.duration - 5) v.currentTime = startAt;
        v.play().catch(() => {});

        // Read subtitle text tracks embedded in video (e.g. MP4 with CEA-608)
        const tracks = Array.from(v.textTracks || []);
        const sTracks = tracks.map((t, i) => ({ index: i, label: t.label || t.language || `Sub ${i + 1}` }));
        if (sTracks.length) setSubtitleTracks(sTracks);

        // Check for HDR via colorSpace (limited browser support)
        try {
          if (v.videoWidth >= 3840 || v.videoHeight >= 2160) {
            setCodecInfo(prev => ({ ...prev, resolution: `${v.videoWidth}×${v.videoHeight}` }));
          }
        } catch (_) {}
      }, { once: true });

      if (!startAt) { v.load(); v.play().catch(() => {}); }
      return () => { v.src = ''; };
    }
  }, [activeSrc]);

  // Single-player reliability: if a direct stream can't be decoded, fall back to HLS transcode
  const handleVideoError = useCallback(() => {
    if (triedHlsFallback.current) return;
    const fallback = toEmbyHlsTranscode(activeSrc);
    if (!fallback || fallback === activeSrc) return;
    triedHlsFallback.current = true;
    setActiveSrc(fallback);
  }, [activeSrc]);

  // ── quality / audio switching ──────────────────────────────────────────────

  const switchQuality = useCallback((levelIndex) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (levelIndex === -1) {
      hls.currentLevel = -1; // auto ABR
    } else {
      hls.currentLevel = levelIndex;
    }
    setCurrentQuality(levelIndex);
    setSettingsTab(null);
    resetHideTimer();
  }, [resetHideTimer]);

  const switchAudio = useCallback((trackIndex) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = trackIndex;
    setCurrentAudio(trackIndex);
    setSettingsTab(null);
    resetHideTimer();
  }, [resetHideTimer]);

  const switchSubtitle = useCallback((trackIndex) => {
    const v = videoRef.current;
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = trackIndex;
    } else if (v) {
      Array.from(v.textTracks || []).forEach((t, i) => {
        t.mode = i === trackIndex ? 'showing' : 'hidden';
      });
    }
    setCurrentSubtitle(trackIndex);
    setSettingsTab(null);
    resetHideTimer();
  }, [resetHideTimer]);

  const disableSubtitles = useCallback(() => {
    const v = videoRef.current;
    const hls = hlsRef.current;
    if (hls) hls.subtitleTrack = -1;
    else if (v) Array.from(v.textTracks || []).forEach(t => { t.mode = 'hidden'; });
    setCurrentSubtitle(-1);
    setSettingsTab(null);
    resetHideTimer();
  }, [resetHideTimer]);

  // ── playback controls ──────────────────────────────────────────────────────

  const flash = (side) => {
    setTapFlash(side);
    setTimeout(() => setTapFlash(null), 600);
  };

  const skip = useCallback((secs) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
    resetHideTimer();
  }, [resetHideTimer]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, [fullscreen]);

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (pip) await document.exitPictureInPicture?.();
    else await v.requestPictureInPicture?.();
  };

  const setPlaybackSpeed = (s) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = s;
    setSpeed(s);
    // Persist speed preference
    try {
      const p = loadPrefs();
      localStorage.setItem('sv_player_prefs', JSON.stringify({ ...p, speed: String(s) }));
    } catch (_) {}
    setSettingsTab(null);
    resetHideTimer();
  };

  // ── MediaSession (lock screen / notification controls) ────────────────────

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: title || 'StreamVault' });
    navigator.mediaSession.setActionHandler('play', () => videoRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => videoRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-skipSecs));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(skipSecs));
    return () => {
      ['play', 'pause', 'seekbackward', 'seekforward'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch (_) {}
      });
    };
  }, [title, skip, skipSecs]);

  // ── keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') { skip(skipSecs); flash('right'); }
      if (e.code === 'ArrowLeft') { skip(-skipSecs); flash('left'); }
      if (e.code === 'KeyF') toggleFullscreen();
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'ArrowUp') {
        const v = videoRef.current;
        if (v) { v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); }
      }
      if (e.code === 'ArrowDown') {
        const v = videoRef.current;
        if (v) { v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skip, toggleFullscreen, toggleMute, skipSecs]);

  // ── video event handlers ───────────────────────────────────────────────────

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    videoRef.current.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const saveProgress = useCallback((completed = false) => {
    const v = videoRef.current;
    if (!v || !onProgress || v.currentTime < 2) return;
    const now = Math.round(v.currentTime);
    if (!completed && Math.abs(now - lastSaved.current) < 5) return;
    lastSaved.current = now;
    onProgress({ progressSeconds: now, totalSeconds: Math.round(v.duration), completed });
  }, [onProgress]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    // For native (non-HLS) sources, seek & play here
    if (!isHls) {
      if (startAt > 0 && startAt < v.duration - 5) v.currentTime = startAt;
      v.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    if (Math.round(v.currentTime) % 10 === 0 && v.currentTime > 5) saveProgress(false);
  };

  const handleSeekHover = (e) => {
    const bar = seekBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setSeekPreview({ x, time: pct * duration });
  };

  const handleVideoTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const x = e.clientX;
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      if (x < w / 3) { skip(-skipSecs); flash('left'); }
      else if (x > (2 * w) / 3) { skip(skipSecs); flash('right'); }
      else { togglePlay(); flash('center'); }
    } else {
      // Single tap always toggles control visibility — on mobile this is the only
      // way to bring the controls back once they've auto-hidden.
      if (showControls) { clearTimeout(hideTimer.current); setShowControls(false); }
      else resetHideTimer();
    }
    lastTap.current = now;
  };

  // ── derived ────────────────────────────────────────────────────────────────

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const qualityLabel = currentQuality === -1
    ? 'Auto'
    : qualityLevels.find(l => l.index === currentQuality)?.label || 'Auto';

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onMouseMove={resetHideTimer}
    >
      <video
        ref={videoRef}
        className={`w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); saveProgress(false); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setPlaying(false); setShowControls(true); saveProgress(true); }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => setIsBuffering(false)}
        onError={handleVideoError}
      />

      {/* Tap-catch layer — always reliably toggles/reveals controls on touch.
          Sits above the video; the controls overlay (higher in DOM) sits above this. */}
      <div className="absolute inset-0" onClick={handleVideoTap} />

      {/* Always-visible quick pause button (top-left) so users can pause even if
          the controls overlay is mid-fade. */}
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        className={`absolute top-5 left-5 z-30 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-opacity ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
      </button>

      {/* Buffering spinner */}
      {isBuffering && !fatalError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Fatal error screen — replaces the blank black screen */}
      {fatalError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/90">
          <p className="text-white/80 text-sm max-w-sm">{fatalError}</p>
          <button
            onClick={() => { saveProgress(false); onClose(); }}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      )}

      {/* Double-tap flash */}
      {tapFlash === 'left' && (
        <div className="absolute left-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="bg-white/10 rounded-full p-5 backdrop-blur-sm"><ChevronLeft className="w-8 h-8 text-white" /></div>
          <span className="text-white text-sm font-semibold">-{skipSecs}s</span>
        </div>
      )}
      {tapFlash === 'right' && (
        <div className="absolute right-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="bg-white/10 rounded-full p-5 backdrop-blur-sm"><ChevronRight className="w-8 h-8 text-white" /></div>
          <span className="text-white text-sm font-semibold">+{skipSecs}s</span>
        </div>
      )}
      {tapFlash === 'center' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/10 rounded-full p-6 backdrop-blur-sm">
            {playing ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white" />}
          </div>
        </div>
      )}

      {/* Big centre play when paused */}
      {!playing && !tapFlash && !isBuffering && (
        <button
          className="absolute w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={togglePlay}
        >
          <Play className="w-9 h-9 fill-white text-white ml-1" />
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-10 bg-gradient-to-b from-black/80 to-transparent">
          <h3 className="text-white font-semibold text-sm truncate max-w-[60%] drop-shadow">{title}</h3>
          <div className="flex items-center gap-2">
            {isHdr && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                {codecInfo?.hdrType || 'HDR'}
              </span>
            )}
            {codecInfo?.resolution && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                {codecInfo.resolution.includes('3840') || codecInfo.resolution.includes('7680') ? '4K' : codecInfo.resolution}
              </span>
            )}
            {isHls && (
              <div className="flex items-center gap-1 text-white/60 text-xs">
                <Wifi className="w-3 h-3" />
                <span>{qualityLabel}</span>
              </div>
            )}
            <button
              onClick={() => { saveProgress(false); onClose(); }}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Codec info panel */}
        {settingsTab === 'info' && (
          <div className="absolute top-16 right-4 bg-black/95 border border-white/10 rounded-xl p-4 min-w-[220px] shadow-2xl text-xs space-y-2">
            <p className="text-white/50 uppercase tracking-widest text-[10px] mb-2">Media Info</p>
            {codecInfo?.container && <div className="flex justify-between"><span className="text-white/50">Container</span><span className="text-white font-mono">{codecInfo.container}</span></div>}
            {codecInfo?.video && <div className="flex justify-between"><span className="text-white/50">Video</span><span className="text-white font-mono">{codecInfo.video}</span></div>}
            {codecInfo?.audio && <div className="flex justify-between"><span className="text-white/50">Audio</span><span className="text-white font-mono">{codecInfo.audio}</span></div>}
            {codecInfo?.resolution && <div className="flex justify-between"><span className="text-white/50">Resolution</span><span className="text-white font-mono">{codecInfo.resolution}</span></div>}
            <div className="flex justify-between"><span className="text-white/50">HDR</span><span className={codecInfo?.hdr ? 'text-amber-400 font-semibold' : 'text-white/40'}>{codecInfo?.hdrType || 'SDR'}</span></div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5">A/V Sync Offset</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setAvOffset(o => Math.round((o - 0.1) * 10) / 10)} className="w-6 h-6 rounded bg-white/10 text-white text-sm hover:bg-white/20">−</button>
                <span className="text-white font-mono text-xs flex-1 text-center">{avOffset > 0 ? '+' : ''}{avOffset.toFixed(1)}s</span>
                <button onClick={() => setAvOffset(o => Math.round((o + 0.1) * 10) / 10)} className="w-6 h-6 rounded bg-white/10 text-white text-sm hover:bg-white/20">+</button>
                <button onClick={() => setAvOffset(0)} className="text-[10px] text-white/40 hover:text-white/70 ml-1">Reset</button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="px-4 pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent space-y-2">
          {/* Seek bar */}
          <div
            ref={seekBarRef}
            className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group"
            onMouseMove={handleSeekHover}
            onMouseLeave={() => setSeekPreview(null)}
          >
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full pointer-events-none" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none" style={{ width: `${progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -ml-2 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
              style={{ left: `${progress}%` }}
            />
            <input
              type="range" min={0} max={duration || 100} step={0.5} value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {seekPreview && (
              <div
                className="absolute bottom-5 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded-md pointer-events-none whitespace-nowrap"
                style={{ left: seekPreview.x }}
              >
                {formatTime(seekPreview.time)}
              </div>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left controls */}
            <div className="flex items-center gap-1">
              <Btn onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </Btn>
              <button
                onClick={() => { skip(-skipSecs); flash('left'); }}
                title={`-${skipSecs}s`}
                className="relative w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold">{skipSecs}</span>
              </button>
              <button
                onClick={() => { skip(skipSecs); flash('right'); }}
                title={`+${skipSecs}s`}
                className="relative w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold">{skipSecs}</span>
              </button>
              <div className="flex items-center gap-1 group/vol">
                <Btn onClick={toggleMute} title="Mute">
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Btn>
                {!IS_TOUCH && (
                  <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                    <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                      onChange={handleVolumeChange} className="w-20 accent-primary cursor-pointer" />
                  </div>
                )}
              </div>
              <span className="text-white/80 text-xs font-mono tabular-nums hidden sm:block ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1">
              {speed !== 1 && (
                <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">{speed}×</span>
              )}

              {/* Subtitle picker */}
              {subtitleTracks.length > 0 && (
                <div className="relative">
                  <Btn onClick={() => setSettingsTab(t => t === 'subs' ? null : 'subs')} title="Subtitles">
                    <Subtitles className={`w-4 h-4 ${currentSubtitle >= 0 ? 'text-primary' : ''}`} />
                  </Btn>
                  {settingsTab === 'subs' && (
                    <div className="absolute bottom-10 right-0 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[150px]">
                      <p className="text-[10px] text-white/50 uppercase tracking-widest px-3 pt-2 pb-1">Subtitles</p>
                      <button onClick={disableSubtitles}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${currentSubtitle === -1 ? 'text-primary font-semibold' : 'text-white'}`}>
                        Off
                      </button>
                      {subtitleTracks.map(t => (
                        <button key={t.index} onClick={() => switchSubtitle(t.index)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${currentSubtitle === t.index ? 'text-primary font-semibold' : 'text-white'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audio track picker */}
              {audioTracks.length > 1 && (
                <div className="relative">
                  <Btn onClick={() => setSettingsTab(t => t === 'audio' ? null : 'audio')} title="Audio Track">
                    <AudioLines className="w-4 h-4" />
                  </Btn>
                  {settingsTab === 'audio' && (
                    <div className="absolute bottom-10 right-0 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[150px]">
                      <p className="text-[10px] text-white/50 uppercase tracking-widest px-3 pt-2 pb-1">Audio Track</p>
                      {audioTracks.map(t => (
                        <button key={t.index} onClick={() => switchAudio(t.index)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${currentAudio === t.index ? 'text-primary font-semibold' : 'text-white'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quality picker */}
              {qualityLevels.length > 1 && (
                <div className="relative">
                  <Btn onClick={() => setSettingsTab(t => t === 'quality' ? null : 'quality')} title="Quality">
                    <Layers className="w-4 h-4" />
                  </Btn>
                  {settingsTab === 'quality' && (
                    <div className="absolute bottom-10 right-0 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[150px]">
                      <p className="text-[10px] text-white/50 uppercase tracking-widest px-3 pt-2 pb-1">Quality</p>
                      <button onClick={() => switchQuality(-1)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${currentQuality === -1 ? 'text-primary font-semibold' : 'text-white'}`}>
                        Auto (ABR)
                      </button>
                      {qualityLevels.map(l => (
                        <button key={l.index} onClick={() => switchQuality(l.index)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${currentQuality === l.index ? 'text-primary font-semibold' : 'text-white'}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Speed / settings */}
              <div className="relative">
                <Btn onClick={() => setSettingsTab(t => t === 'speed' ? null : 'speed')} title="Settings">
                  <Settings className="w-4 h-4" />
                </Btn>
                {settingsTab === 'speed' && (
                  <div className="absolute bottom-10 right-0 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[130px]">
                    <p className="text-[10px] text-white/50 uppercase tracking-widest px-3 pt-2 pb-1">Speed</p>
                    {SPEEDS.map(s => (
                      <button key={s} onClick={() => setPlaybackSpeed(s)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${speed === s ? 'text-primary font-semibold' : 'text-white'}`}>
                        {s === 1 ? 'Normal' : `${s}×`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Media info / A-V sync */}
              <Btn onClick={() => setSettingsTab(t => t === 'info' ? null : 'info')} title="Media Info">
                <Info className={`w-4 h-4 ${settingsTab === 'info' ? 'text-primary' : ''}`} />
              </Btn>

              <Btn onClick={togglePip} title="Picture in Picture">
                <PictureInPicture2 className={`w-4 h-4 ${pip ? 'text-primary' : ''}`} />
              </Btn>

              <Btn onClick={toggleFullscreen} title="Fullscreen">
                {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}