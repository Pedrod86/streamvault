import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { X, Layers, Volume2, VolumeX, Maximize, Subtitles, ChevronDown } from 'lucide-react';
import PlayerPicker, { PLAYERS } from './PlayerPicker';
import ExternalPlayerView from './ExternalPlayerView';

export default function EmbyVideoPlayer({ item, server, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [playerId, setPlayerId] = useState('direct'); // default: direct play
  const [showPicker, setShowPicker] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [codecLabel, setCodecLabel] = useState('');
  const [subtitles, setSubtitles] = useState([]); // { index, label, language }
  const [activeSub, setActiveSub] = useState(-1); // -1 = off
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef(null);

  const base = server?.server_url?.replace(/\/$/, '') || '';
  const token = server?.api_token || '';

  const hlsUrl = `${base}/Videos/${item.id}/master.m3u8?api_key=${token}&VideoCodec=h264,hevc,av1,vp9&AudioCodec=aac,mp3,ac3,eac3,flac,opus&SubtitleMethod=Encode&TranscodingMaxAudioChannels=2&RequireAvc=false&EnableAdaptiveBitrateStreaming=true`;
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
    if (['vlc', 'infuse', 'mx'].includes(playerId)) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (playerId === 'direct') {
      video.src = directUrl;
      video.play().catch(() => {});
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
        if (codec.includes('hev') || codec.includes('hvc')) setCodecLabel('HEVC');
        else if (codec.includes('av01')) setCodecLabel('AV1');
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

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [playerId, hlsUrl, directUrl]);

  // Sync volume to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

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

  if (['vlc', 'infuse', 'mx'].includes(playerId)) {
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
      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

      {/* Video — no native controls so our custom volume slider works on Android */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
      />

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 px-4 pb-6 pt-10 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-4">

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(m => !m)}
            className="text-white/80 hover:text-white transition-colors shrink-0"
          >
            {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0) setMuted(false);
            }}
            className="w-24 accent-primary cursor-pointer"
          />

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
                    <button
                      onClick={() => { setActiveSub(-1); setShowSubPicker(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSub === -1 ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      Off
                    </button>
                    {subtitles.map(s => (
                      <button
                        key={s.index}
                        onClick={() => { setActiveSub(s.index); setShowSubPicker(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSub === s.index ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => videoRef.current?.requestFullscreen?.()}
            className="text-white/70 hover:text-white transition-colors"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}