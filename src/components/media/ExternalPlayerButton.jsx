import React, { useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLAYERS } from './PlayerPicker';
import ExternalPlayerView from './ExternalPlayerView';

/**
 * A self-contained "External Player" button + dropdown that launches a stream
 * in VLC / MX Player / Infuse / mpv / web player.
 *
 * Provide EITHER a ready `streamUrl` (+ `title`) — for IPTV / Plex — OR an
 * Emby/Jellyfin `item` (+ `server`) so the stream URL is built from it.
 *
 * `variant`:
 *   - 'button' (default) — an outline button styled like the other detail actions
 *   - 'icon'   — a compact circular icon button (for player toolbars)
 */
export default function ExternalPlayerButton({ streamUrl, title, item, server, variant = 'button', className = '' }) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  const externalPlayers = PLAYERS.filter(p => p.external);

  return (
    <>
      <div className="relative inline-block">
        {variant === 'icon' ? (
          <button
            onClick={() => setOpen(o => !o)}
            title="Open in external player"
            className={`w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/15 active:bg-white/25 transition-colors ${className}`}
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        ) : (
          <Button
            variant="outline"
            className={`border-border text-foreground hover:bg-secondary gap-2 h-11 px-5 rounded-xl select-none ${className}`}
            onClick={() => setOpen(o => !o)}
          >
            <ExternalLink className="w-4 h-4" /> External Player
            <ChevronDown className="w-4 h-4" />
          </Button>
        )}

        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className={`absolute ${variant === 'icon' ? 'top-11 right-0' : 'top-12 left-0'} w-72 max-h-[60vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl z-30`}>
              <div className="px-4 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card">
                Open in external app
              </div>
              <div className="p-1.5 space-y-0.5">
                {externalPlayers.map(p => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setOpen(false); setPlayerId(p.id); }}
                      className="w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left text-foreground hover:bg-secondary transition-colors"
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{p.label}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {playerId && (
        <ExternalPlayerView
          streamUrl={streamUrl}
          title={title}
          item={item}
          server={server}
          playerId={playerId}
          onClose={() => setPlayerId(null)}
          onSwitchPlayer={(p) => setPlayerId(p)}
        />
      )}
    </>
  );
}