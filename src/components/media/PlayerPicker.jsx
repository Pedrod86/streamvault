import React from 'react';
import { Monitor, Tv2, ExternalLink, Check } from 'lucide-react';

export const PLAYERS = [
  {
    id: 'native',
    label: 'Built-in Player',
    description: 'Browser HTML5 video — best for most content',
    icon: Monitor,
  },
  {
    id: 'hls',
    label: 'HLS Stream',
    description: 'Force HLS transcoding — fixes most playback errors',
    icon: Tv2,
  },
  {
    id: 'vlc',
    label: 'VLC',
    description: 'Open in VLC media player (must be installed)',
    icon: ExternalLink,
  },
  {
    id: 'infuse',
    label: 'Infuse / nPlayer',
    description: 'Open in Infuse or nPlayer on iOS/tvOS',
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
      <div className="px-4 py-2.5 border-t border-white/10">
        <p className="text-[10px] text-white/30 leading-relaxed">
          If playback fails, try HLS Stream. For external players, VLC / Infuse must be installed on your device.
        </p>
      </div>
    </div>
  );
}