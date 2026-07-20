import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Layers } from 'lucide-react';
import PlayerPicker, { PLAYERS } from './PlayerPicker';

/**
 * Launches a stream in an external player app (VLC / MX Player / Infuse / mpv / web).
 *
 * Pass EITHER:
 *  - `streamUrl` (+ `title`) — a ready-to-play direct URL (IPTV, Plex, or any source), OR
 *  - `item` (+ `server`)     — an Emby/Jellyfin item; the stream URL is built from it.
 */
export default function ExternalPlayerView({ item, server, streamUrl: directUrl, title: directTitle, playerId, onClose, onSwitchPlayer }) {
  // Resolve the stream URL — prefer an explicitly passed one, else build the Emby/Jellyfin URL.
  const embyUrl = item && server
    ? `${server.server_url.replace(/\/$/, '')}/Videos/${item.id}/stream?api_key=${server.api_token}&Static=true`
    : null;
  const streamUrl = directUrl || embyUrl || '';
  const title = directTitle || item?.title || '';

  // For Emby/Jellyfin we can also build an HDR-capable HLS URL some players prefer.
  const hdrStreamUrl = item && server
    ? `${server.server_url.replace(/\/$/, '')}/Videos/${item.id}/master.m3u8?api_key=${server.api_token}&VideoCodec=hevc,av1,h264&AudioCodec=aac,ac3,eac3,flac,opus&AllowVideoStreamCopy=true&AllowAudioStreamCopy=true&VideoBitDepth=10&SubtitleMethod=Encode&EnableAdaptiveBitrateStreaming=true`
    : streamUrl;

  // MX Player intent: try pro first, fall back to free, then open web fallback
  const mxIntent = `intent:${streamUrl}#Intent;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${encodeURIComponent(title)};end`;
  const mxIntentFree = `intent:${streamUrl}#Intent;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`;

  const schemeMap = {
    mpv: `mpv://${hdrStreamUrl}`,
    vlc: `vlc://${hdrStreamUrl}`,
    infuse: `infuse://x-callback-url/play?url=${encodeURIComponent(hdrStreamUrl)}`,
    mx: mxIntent,
    moviplayer: `https://moviplayer.com/?src=${encodeURIComponent(hdrStreamUrl)}`,
    onlineplayer: `https://onlineplayer.app/en?autoload=${encodeURIComponent(hdrStreamUrl)}&theme=dark`,
  };

  const scheme = schemeMap[playerId] || `vlc://${streamUrl}`;
  const playerLabel = PLAYERS.find(p => p.id === playerId)?.label || 'External Player';
  const [showPicker, setShowPicker] = useState(false);
  const [launched, setLaunched] = useState(false);

  // Auto-launch MX Player immediately on mount
  useEffect(() => {
    if (playerId === 'mx') {
      // Try pro first
      window.location.href = mxIntent;
      // After short delay, try free version as fallback
      const t = setTimeout(() => {
        window.location.href = mxIntentFree;
      }, 1500);
      setLaunched(true);
      return () => clearTimeout(t);
    }
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWebPlayer = ['moviplayer', 'onlineplayer'].includes(playerId);
  const shownUrl = ['mpv', 'vlc'].includes(playerId) ? hdrStreamUrl : streamUrl;

  const handleLaunch = () => {
    if (isWebPlayer) {
      window.open(scheme, '_blank');
    } else {
      window.location.href = scheme;
    }
    setLaunched(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6 p-8">
      <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white">
        <X className="w-6 h-6" />
      </button>
      <button
        onClick={() => setShowPicker(p => !p)}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20"
      >
        <Layers className="w-3.5 h-3.5" /> {playerLabel}
      </button>
      {showPicker && (
        <PlayerPicker current={playerId} onChange={(p) => { onSwitchPlayer(p); setShowPicker(false); }} onClose={() => setShowPicker(false)} />
      )}
      <ExternalLink className="w-14 h-14 text-primary" />
      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-white text-xl font-bold">{title}</h2>
        {playerId === 'mx' && launched ? (
          <p className="text-white/60 text-sm">Launching <span className="text-primary font-semibold">MX Player</span>…</p>
        ) : (
          <p className="text-white/60 text-sm">Ready to open in <span className="text-primary font-semibold">{playerLabel}</span></p>
        )}
        <p className="text-white/30 text-xs mt-2 break-all">{shownUrl}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleLaunch}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" /> {launched && playerId === 'mx' ? 'Re-launch MX Player' : `Open in ${playerLabel}`}
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(shownUrl)}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium text-sm"
        >
          Copy Stream URL
        </button>
      </div>
      <p className="text-white/25 text-xs text-center max-w-xs">
        {playerId === 'mx' ? 'MX Player (Pro or Free) must be installed on your Android device.' : `${playerLabel} must be installed on your device.`}
      </p>
    </div>
  );
}