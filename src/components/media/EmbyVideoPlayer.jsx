import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Subtitles, Music, Settings, Check, ChevronLeft
} from 'lucide-react';

function formatTime(secs) {
  const s = Math.floor(secs || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Report playback session to Emby (start / progress / stop)
// positionTicks = seconds * 10_000_000
async function reportPlayback(base, token, action, itemId, positionSeconds, isPaused = false) {
  const ticks = Math.round((positionSeconds || 0) * 10_000_000);
  const body = { ItemId: itemId, PositionTicks: ticks, IsPaused: isPaused, CanSeek: true };
  const url = action === 'stop'
    ? `${base}/Sessions/Playing/Stopped`
    : action === 'start'
    ? `${base}/Sessions/Playing`
    : `${base}/Sessions/Playing/Progress`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'X-Emby-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (_) { /* best-effort */ }
}

// Fetch playback info from Emby: subtitles, audio streams, video streams
async function fetchPlaybackInfo(base, itemId, token) {
  try {
    const res = await fetch(
      `${base}/Items/${itemId}/PlaybackInfo?UserId=&api_key=${token}`,
      { headers: { 'X-Emby-Token': token } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function MenuPanel({ title, items, activeIndex, onSelect, onBack }) {
  return (
    <div className="absolute bottom-20 right-4 w-64 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-10">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
        {onBack && (
          <button onClick={onBack} className="text-white/60 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <span className="text-white text-xs font-semibold">{title}</span>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/10 ${
              i === activeIndex ? 'text-primary' : 'text-white/80'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {i === activeIndex && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EmbyVideoPlayer({ item, server, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const progressInterval = useRef(null);

  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);

  // Emby stream info
  const [mediaSources, setMediaSources] = useState([]);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1); // -1 = off

  // Menu state
  const [openMenu, setOpenMenu] = useState(null); // 'quality' | 'audio' | 'subtitle' | 'settings' | null

  // Build stream URL for a given source and audio/subtitle index
  const buildStreamUrl = useCallback((sourceIdx = 0, audioIdx = 0) => {
    const source = mediaSources[sourceIdx];
    const mediaSourceId = source?.Id || item.id;
    const audioStreamIndex = audioTracks[audioIdx]?.Index ?? undefined;
    let url = `${base}/Videos/${item.id}/stream?api_key=${token}&Static=true&MediaSourceId=${mediaSourceId}`;
    if (audioStreamIndex !== undefined) url += `&AudioStreamIndex=${audioStreamIndex}`;
    return url;
  }, [base, token, item.id, mediaSources, audioTracks]);

  // Fetch playback info on mount
  useEffect(() => {
    fetchPlaybackInfo(base, item.id, token).then(info => {
      if (!info?.MediaSources?.length) return;
      const sources = info.MediaSources;
      setMediaSources(sources);

      // Extract streams from first source
      const streams = sources[0]?.MediaStreams || [];
      const audio = streams.filter(s => s.Type === 'Audio');
      const subs = streams.filter(s => s.Type === 'Subtitle');

      setAudioTracks(audio.map((s, i) => ({
        Index: s.Index,
        label: [s.Language, s.Codec, s.Title].filter(Boolean).join(' · ') || `Audio ${i + 1}`,
      })));

      setSubtitleTracks([
        { label: 'Off', Index: -1 },
        ...subs.map((s, i) => ({
          Index: s.Index,
          label: [s.Language, s.Title].filter(Boolean).join(' · ') || `Subtitle ${i + 1}`,
        }))
      ]);
    });
  }, [base, item.id, token]);

  // Build quality options from mediaSources
  const qualityOptions = mediaSources.map((s, i) => ({
    label: s.Name || s.VideoType || `Source ${i + 1}`,
  }));

  // Reload video when source/audio changes
  const reloadVideo = useCallback((sourceIdx, audioIdx) => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    v.src = buildStreamUrl(sourceIdx, audioIdx);
    v.load();
    v.currentTime = t;
    v.play();
  }, [buildStreamUrl]);

  const handleQualitySelect = (idx) => {
    setActiveSourceIdx(idx);
    reloadVideo(idx, activeAudio);
    setOpenMenu(null);
  };

  const handleAudioSelect = (idx) => {
    setActiveAudio(idx);
    reloadVideo(activeSourceIdx, idx);
    setOpenMenu(null);
  };

  const handleSubtitleSelect = (idx) => {
    setActiveSubtitle(idx);
    setOpenMenu(null);
    // Emby external subtitle via <track> is applied in render
  };

  // Controls auto-hide
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  // Report playback start to Emby
  useEffect(() => {
    reportPlayback(base, token, 'start', item.id, 0);
    // Report progress every 10 seconds
    progressInterval.current = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      reportPlayback(base, token, 'progress', item.id, v.currentTime, v.paused);
    }, 10_000);
    return () => {
      clearInterval(progressInterval.current);
      // Report stop with final position
      const v = videoRef.current;
      reportPlayback(base, token, 'stop', item.id, v?.currentTime || 0);
    };
  }, [base, token, item.id]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play();
    resetHideTimer();
  };

  const skip = (secs) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + secs));
  };

  const toggleFullscreen = () => {
    if (!fullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setMuted(val === 0);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // Active subtitle track for <track> element
  const activeSub = activeSubtitle >= 0 ? subtitleTracks[activeSubtitle] : null;
  const subSrc = activeSub && activeSub.Index >= 0
    ? `${base}/Videos/${item.id}/${item.id}/Subtitles/${activeSub.Index}/Stream.vtt?api_key=${token}`
    : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={buildStreamUrl(activeSourceIdx, activeAudio)}
        className="w-full h-full object-contain"
        autoPlay
        onPlay={() => {
          setPlaying(true); setLoading(false);
          reportPlayback(base, token, 'progress', item.id, videoRef.current?.currentTime || 0, false);
        }}
        onPause={() => {
          setPlaying(false); setShowControls(true);
          reportPlayback(base, token, 'progress', item.id, videoRef.current?.currentTime || 0, true);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onClick={() => { togglePlay(); setOpenMenu(null); }}
        crossOrigin="anonymous"
      >
        {subSrc && <track kind="subtitles" src={subSrc} default />}
      </video>

      {/* Spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 select-none ${
          showControls || openMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <button
              className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight truncate max-w-[60vw]">{item.title}</h3>
              {item.year && <p className="text-white/50 text-xs">{item.year}</p>}
            </div>
          </div>
        </div>

        {/* Centre play button when paused */}
        {!playing && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-7 h-7 fill-white text-white ml-1" />
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="p-3 sm:p-4 bg-gradient-to-t from-black/90 to-transparent space-y-2">
          {/* Seek bar */}
          <div className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group mx-1">
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            <input
              type="range" min={0} max={duration || 100} step={0.5} value={currentTime}
              onChange={e => { videoRef.current.currentTime = parseFloat(e.target.value); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: `${progress}%` }} />
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Left */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={togglePlay} className="text-white w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>
              <button onClick={() => skip(-10)} className="text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={() => skip(10)} className="text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
              {/* Volume */}
              <div className="flex items-center gap-1">
                <button onClick={() => { const v = !muted; videoRef.current.muted = v; setMuted(v); }} className="text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 accent-primary cursor-pointer hidden sm:block"
                />
              </div>
              <span className="text-white text-xs font-mono tabular-nums ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right — Emby controls */}
            <div className="flex items-center gap-1">
              {subtitleTracks.length > 1 && (
                <button
                  onClick={() => setOpenMenu(openMenu === 'subtitle' ? null : 'subtitle')}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${openMenu === 'subtitle' ? 'bg-primary text-primary-foreground' : 'text-white hover:bg-white/10'}`}
                  title="Subtitles"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
              )}
              {audioTracks.length > 1 && (
                <button
                  onClick={() => setOpenMenu(openMenu === 'audio' ? null : 'audio')}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${openMenu === 'audio' ? 'bg-primary text-primary-foreground' : 'text-white hover:bg-white/10'}`}
                  title="Audio track"
                >
                  <Music className="w-4 h-4" />
                </button>
              )}
              {qualityOptions.length > 1 && (
                <button
                  onClick={() => setOpenMenu(openMenu === 'quality' ? null : 'quality')}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${openMenu === 'quality' ? 'bg-primary text-primary-foreground' : 'text-white hover:bg-white/10'}`}
                  title="Quality"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <button onClick={toggleFullscreen} className="text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popup menus */}
      {openMenu === 'subtitle' && (
        <MenuPanel
          title="Subtitles"
          items={subtitleTracks}
          activeIndex={activeSubtitle === -1 ? 0 : activeSubtitle}
          onSelect={handleSubtitleSelect}
          onBack={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'audio' && (
        <MenuPanel
          title="Audio Track"
          items={audioTracks}
          activeIndex={activeAudio}
          onSelect={handleAudioSelect}
          onBack={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'quality' && (
        <MenuPanel
          title="Quality"
          items={qualityOptions}
          activeIndex={activeSourceIdx}
          onSelect={handleQualitySelect}
          onBack={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}