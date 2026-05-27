import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, PictureInPicture2,
  ChevronLeft, ChevronRight, Wifi, Layers, AudioLines
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

// ── HLS config matching Media3 default buffer settings ────────────────────────
const HLS_CONFIG = {
  // Media3 default: 50s max buffer, 10s min before playback starts
  maxBufferLength: 50,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1000 * 1000, // 60 MB
  maxBufferHole: 0.5,
  // Start level: auto (ABR)
  startLevel: -1,
  // Low latency ABR — matches Media3 AdaptiveTrackSelection
  abrEwmaDefaultEstimate: 500000,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  // Stall recovery — Media3 retries on error
  manifestLoadingMaxRetry: 6,
  manifestLoadingRetryDelay: 1000,
  levelLoadingMaxRetry: 6,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  // Faster switching
  appendErrorMaxRetry: 3,
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

  // Settings panel tabs: 'speed' | 'quality' | 'audio'
  const [settingsTab, setSettingsTab] = useState(null);

  // HLS track info
  const [qualityLevels, setQualityLevels] = useState([]); // { index, label, bitrate }
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [audioTracks, setAudioTracks] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [isHls, setIsHls] = useState(false);

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

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;

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

        v.volume = initVol;
        if (startAt > 0) v.currentTime = startAt;
        v.play().catch(() => {});
      });

      // Track ABR switches
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        if (hls.autoLevelEnabled) setCurrentQuality(-1);
        else setCurrentQuality(data.level);
      });

      // Stall recovery — Media3 equivalent of LoadControl
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Native playback (MP4, native HLS on Safari, etc.)
      setIsHls(false);
      v.src = src;
      v.volume = initVol;
      if (startAt > 0) {
        v.addEventListener('loadedmetadata', () => {
          if (startAt < v.duration - 5) v.currentTime = startAt;
          v.play().catch(() => {});
        }, { once: true });
      } else {
        v.load();
        v.play().catch(() => {});
      }
      return () => { v.src = ''; };
    }
  }, [src]);

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
      if (playing) {
        if (showControls) { clearTimeout(hideTimer.current); setShowControls(false); }
        else resetHideTimer();
      }
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
        className={`w-full h-full object-${fitMode}`}
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
        onClick={handleVideoTap}
      />

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
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
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-10 bg-gradient-to-b from-black/80 to-transparent">
          <h3 className="text-white font-semibold text-sm truncate max-w-[70%] drop-shadow">{title}</h3>
          <div className="flex items-center gap-2">
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
              <Btn onClick={() => { skip(-skipSecs); flash('left'); }} title={`-${skipSecs}s`}><SkipBack className="w-4 h-4" /></Btn>
              <Btn onClick={() => { skip(skipSecs); flash('right'); }} title={`+${skipSecs}s`}><SkipForward className="w-4 h-4" /></Btn>
              <div className="flex items-center gap-1 group/vol">
                <Btn onClick={toggleMute} title="Mute">
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Btn>
                <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                  <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                    onChange={handleVolumeChange} className="w-20 accent-primary cursor-pointer" />
                </div>
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

              {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                <Btn onClick={togglePip} title="Picture in Picture">
                  <PictureInPicture2 className={`w-4 h-4 ${pip ? 'text-primary' : ''}`} />
                </Btn>
              )}

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