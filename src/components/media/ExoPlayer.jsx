import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, PictureInPicture2,
  ChevronLeft, ChevronRight
} from 'lucide-react';

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function Btn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors"
    >
      {children}
    </button>
  );
}

export default function ExoPlayer({ src, title, onClose, onProgress, startAt = 0 }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const lastSaved = useRef(0);
  const seekBarRef = useRef(null);
  const lastTap = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seekPreview, setSeekPreview] = useState(null);
  const [tapFlash, setTapFlash] = useState(null);
  const [pip, setPip] = useState(false);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (playing) resetHideTimer();
    else { clearTimeout(hideTimer.current); setShowControls(true); }
    return () => clearTimeout(hideTimer.current);
  }, [playing, resetHideTimer]);

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

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') { skip(10); flash('right'); }
      if (e.code === 'ArrowLeft') { skip(-10); flash('left'); }
      if (e.code === 'KeyF') toggleFullscreen();
      if (e.code === 'KeyM') toggleMute();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skip, toggleFullscreen, toggleMute]);

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
    setShowSettings(false);
    resetHideTimer();
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
    if (startAt > 0 && startAt < v.duration - 5) v.currentTime = startAt;
    v.play().catch(() => {});
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
      if (x < w / 3) { skip(-10); flash('left'); }
      else if (x > (2 * w) / 3) { skip(10); flash('right'); }
      else { togglePlay(); flash('center'); }
    } else {
      if (playing) {
        if (showControls) { clearTimeout(hideTimer.current); setShowControls(false); }
        else resetHideTimer();
      }
    }
    lastTap.current = now;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onMouseMove={resetHideTimer}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); saveProgress(false); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setPlaying(false); setShowControls(true); saveProgress(true); }}
        onClick={handleVideoTap}
      />

      {/* Double-tap flash */}
      {tapFlash === 'left' && (
        <div className="absolute left-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="bg-white/10 rounded-full p-5 backdrop-blur-sm"><ChevronLeft className="w-8 h-8 text-white" /></div>
          <span className="text-white text-sm font-semibold">-10s</span>
        </div>
      )}
      {tapFlash === 'right' && (
        <div className="absolute right-0 inset-y-0 w-1/3 flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="bg-white/10 rounded-full p-5 backdrop-blur-sm"><ChevronRight className="w-8 h-8 text-white" /></div>
          <span className="text-white text-sm font-semibold">+10s</span>
        </div>
      )}
      {tapFlash === 'center' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/10 rounded-full p-6 backdrop-blur-sm">
            {playing ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white" />}
          </div>
        </div>
      )}

      {/* Big centre play button when paused */}
      {!playing && !tapFlash && (
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
          <h3 className="text-white font-semibold text-sm truncate max-w-[80%] drop-shadow">{title}</h3>
          <button
            onClick={() => { saveProgress(false); onClose(); }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
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
            <div className="flex items-center gap-1">
              <Btn onClick={togglePlay}>
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </Btn>
              <Btn onClick={() => { skip(-10); flash('left'); }}><SkipBack className="w-4 h-4" /></Btn>
              <Btn onClick={() => { skip(10); flash('right'); }}><SkipForward className="w-4 h-4" /></Btn>
              <div className="flex items-center gap-1 group/vol">
                <Btn onClick={toggleMute}>
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

            <div className="flex items-center gap-1">
              {speed !== 1 && (
                <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">{speed}×</span>
              )}
              <div className="relative">
                <Btn onClick={() => setShowSettings(s => !s)}><Settings className="w-4 h-4" /></Btn>
                {showSettings && (
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
                <Btn onClick={togglePip}><PictureInPicture2 className={`w-4 h-4 ${pip ? 'text-primary' : ''}`} /></Btn>
              )}
              <Btn onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}