import React, { useState } from 'react';
import { X, ExternalLink, Layers } from 'lucide-react';
import PlayerPicker, { PLAYERS } from './PlayerPicker';

export default function ExternalPlayerView({ item, server, playerId, onClose, onSwitchPlayer }) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const streamUrl = `${base}/Videos/${item.id}/stream?api_key=${token}&Static=true`;
  // HDR10+ passthrough: request 10-bit HLS with video stream copy for MPV/VLC
  const hdrStreamUrl = `${base}/Videos/${item.id}/master.m3u8?api_key=${token}&VideoCodec=hevc,av1,h264&AudioCodec=aac,ac3,eac3,flac,opus&AllowVideoStreamCopy=true&AllowAudioStreamCopy=true&VideoBitDepth=10&SubtitleMethod=Encode&EnableAdaptiveBitrateStreaming=true`;
  const encodedUrl = encodeURIComponent(hdrStreamUrl);

  const schemeMap = {
    mpv: `mpv://${hdrStreamUrl}`,
    vlc: `vlc://${hdrStreamUrl}`,
    infuse: `infuse://x-callback-url/play?url=${encodedUrl}`,
    mx: `intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;end`,
  };

  const scheme = schemeMap[playerId] || `vlc://${streamUrl}`;
  const playerLabel = PLAYERS.find(p => p.id === playerId)?.label || 'External Player';
  const [showPicker, setShowPicker] = useState(false);

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
        <h2 className="text-white text-xl font-bold">{item.title}</h2>
        <p className="text-white/60 text-sm">Ready to open in <span className="text-primary font-semibold">{playerLabel}</span></p>
        <p className="text-white/30 text-xs mt-2 break-all">{['mpv','vlc'].includes(playerId) ? hdrStreamUrl : streamUrl}</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href={scheme}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" /> Open in {playerLabel}
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(['mpv','vlc'].includes(playerId) ? hdrStreamUrl : streamUrl)}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium text-sm"
        >
          Copy Stream URL
        </button>
      </div>
      <p className="text-white/25 text-xs text-center max-w-xs">
        {playerLabel} must be installed on your device.
      </p>
    </div>
  );
}