import React from 'react';
import { Play, Check, ExternalLink, Smartphone, MonitorPlay, Film } from 'lucide-react';

export const PLAYERS = [
  {
    id: 'exoplayer',
    label: 'ExoPlayer (Default)',
    description: 'Built-in StreamVault player — optimised for mobile, supports all formats',
    icon: Play,
    external: false,
  },
  {
    id: 'hls',
    label: 'HLS Player',
    description: 'Adaptive HLS streaming via HLS.js — great for live & adaptive streams',
    icon: Play,
    external: false,
  },
  {
    id: 'shaka',
    label: 'Shaka Player',
    description: 'Google\'s Shaka Player — excellent DASH & HLS support with DRM (Widevine/PlayReady)',
    icon: Play,
    external: false,
  },
  // ── External players (launch installed apps on your device) ──
  {
    id: 'vlc',
    label: 'VLC',
    description: 'Open in the VLC app — plays almost any format on Android, iOS & desktop',
    icon: MonitorPlay,
    external: true,
  },
  {
    id: 'mx',
    label: 'MX Player',
    description: 'Open in MX Player (Pro or Free) — popular Android video player',
    icon: Smartphone,
    external: true,
  },
  {
    id: 'infuse',
    label: 'Infuse',
    description: 'Open in Infuse — premium player for iOS, iPadOS, tvOS & macOS',
    icon: Film,
    external: true,
  },
  {
    id: 'mpv',
    label: 'mpv',
    description: 'Open in mpv — lightweight, powerful player for desktop',
    icon: MonitorPlay,
    external: true,
  },
  {
    id: 'onlineplayer',
    label: 'Online Player (Web)',
    description: 'Play in a browser-based player — no app install needed',
    icon: ExternalLink,
    external: true,
  },
];

export default function PlayerPicker({ current, onChange, onClose }) {
  const builtIn = PLAYERS.filter(p => !p.external);
  const external = PLAYERS.filter(p => p.external);

  const renderItem = (p) => {
    const Icon = p.icon;
    const active = current === p.id;
    return (
      <button
        key={p.id}
        onClick={() => { onChange(p.id); onClose(); }}
        className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          active ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'
        }`}
      >
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">{p.label}</div>
          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.description}</div>
        </div>
        {active && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
      </button>
    );
  };

  return (
    <div className="absolute top-10 left-0 w-72 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl z-30">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-card">
        <span className="text-foreground text-sm font-semibold">Player</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <div className="p-1.5 space-y-0.5">
        <div className="px-3 pt-1 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Built-in</div>
        {builtIn.map(renderItem)}
        <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">External apps</div>
        {external.map(renderItem)}
      </div>
    </div>
  );
}