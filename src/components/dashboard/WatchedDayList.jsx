import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye } from 'lucide-react';

// Renders the watch-history entries that were watched on a given weekday.
// `entries` are pre-resolved { id, title, media_id, last_watched } objects.
export default function WatchedDayList({ entries }) {
  const navigate = useNavigate();

  if (!entries || entries.length === 0) return null;

  const play = (e) => {
    // media_id is either a Media record id or an "emby:<id>" key — both route to detail+play.
    navigate(`/media/${e.media_id}`);
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
        <Eye className="w-3 h-3" /> Watched
      </div>
      {entries.map(e => (
        <div key={e.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 bg-secondary/40">
          <span className="flex-1 text-xs truncate text-muted-foreground">{e.title}</span>
          <button
            onClick={() => play(e)}
            title="Play"
            className="w-6 h-6 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center text-primary-foreground shrink-0"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      ))}
    </div>
  );
}