import React from 'react';
import { Monitor, Tv2, ExternalLink, Check, Zap, Play } from 'lucide-react';

export const PLAYERS = [
  {
    id: 'directplay',
    label: 'Direct Play',
    description: 'Native browser playback — zero transcoding, maximum quality (default)',
    icon: Zap,
  },
  {
    id: 'videojs',
    label: 'Video.js',
    description: 'Most popular open-source player — great HLS/ABR support',
    icon: Play,
  },
  {
    id: 'plyr',
    label: 'Plyr',
    description: 'Clean modern UI with HLS.js — simple and reliable',
    icon: Play,
  },
  {
    id: 'shaka',
    label: 'Shaka Player',
    description: "Google's player — excellent HLS + DASH adaptive streaming",
    icon: Monitor,
  },
  {
    id: 'mediaelement',
    label: 'MediaElement.js',
    description: 'Solid cross-browser HLS player, great compatibility',
    icon: Tv2,
  },
  {
    id: 'mpv',
    label: 'MPV',
    description: 'Open in MPV — full HDR10+, Dolby Vision, all codecs (must be installed)',
    icon: ExternalLink,
  },
  {
    id: 'vlc',
    label: 'VLC',
    description: 'Open in VLC — supports HDR10+, all codecs (must be installed)',
    icon: ExternalLink,
  },
  {
    id: 'infuse',
    label: 'Infuse / nPlayer',
    description: 'Open in Infuse or nPlayer on iOS/tvOS',
    icon: ExternalLink,
  },
  {
    id: 'mx',
    label: 'MX Player',
    description: 'Open in MX Player on Android',
    icon: ExternalLink,
  },
  {
    id: 'onlineplayer',
    label: 'OnlinePlayer',
    description: 'Embeddable online player — plays MKV, MP4, HLS and more',
    icon: Play,
  },
  {
    id: 'moviplayer',
    label: 'MoviPlayer',
    description: 'Open in MoviPlayer — plays HEVC, AV1, HDR in browser (new tab)',
    icon: ExternalLink,
  },
];

export default function PlayerPicker({ current, onChange, onClose }) {
  return (
    <div className="absolute top-16 right-4 w-72 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-white text-sm font-semibold">Choose Player</span>
        <button onClick={onClose} className="text-white/50 hover:text-white text-xs">✕</button>
      </div>
      <div className="p-2 space-y-1">
        {PLAYERS.map(p => {
          const Icon = p.icon;
          const active = current === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); onClose(); }}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                active ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{p.label}</div>
                <div className="text-[10px] text-white/40 leading-tight mt-0.5">{p.description}</div>
              </div>
              {active && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}