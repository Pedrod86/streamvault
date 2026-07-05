import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Play, ChevronRight, Loader2, Tv } from 'lucide-react';
import ExoPlayer from './ExoPlayer';

/**
 * Season/episode browser for a Plex series. Each episode carries its own
 * direct-play stream URL (resolved server-side by plexEpisodes).
 */
export default function PlexSeriesBrowser({ item, onClose }) {
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingEpisode, setPlayingEpisode] = useState(null);

  const seriesId = item.id;

  useEffect(() => {
    if (!seriesId) {
      setError('Cannot browse this series — Plex ID not available.');
      setLoading(false);
      return;
    }
    setLoading(true);
    base44.functions.invoke('plexEpisodes', { seriesId })
      .then(res => {
        if (res.data?.error) throw new Error(res.data.error);
        const { seasons: s, episodes: e } = res.data;
        setSeasons(s || []);
        setEpisodes(e || []);
        if (s?.length > 0) setActiveSeason(s[0].index);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load episodes');
        setLoading(false);
      });
  }, [seriesId]);

  if (playingEpisode?.streamUrl) {
    return (
      <ExoPlayer
        src={playingEpisode.streamUrl}
        title={`${item.title} — ${playingEpisode.name}`}
        onClose={() => setPlayingEpisode(null)}
      />
    );
  }

  const visibleEpisodes = activeSeason !== null
    ? episodes.filter(e => e.seasonIndex === activeSeason)
    : episodes;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {item.poster_url && (
            <img src={item.poster_url} alt={item.title} className="w-8 h-12 rounded object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-base text-foreground truncate">{item.title}</h2>
            {item.year && <p className="text-xs text-muted-foreground">{item.year}</p>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading episodes…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <Tv className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Season tabs */}
          {seasons.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 border-b border-border" style={{ scrollbarWidth: 'none' }}>
              {seasons.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSeason(s.index)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeSeason === s.index
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Episodes list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {visibleEpisodes.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No episodes found for this season.
              </div>
            ) : (
              visibleEpisodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setPlayingEpisode(ep)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-secondary relative">
                    {ep.thumbUrl ? (
                      <img src={ep.thumbUrl} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      S{String(ep.seasonIndex).padStart(2, '0')}E{String(ep.episodeIndex).padStart(2, '0')}
                      {ep.durationMinutes ? ` · ${ep.durationMinutes}m` : ''}
                    </p>
                    <p className="text-sm font-medium text-foreground truncate">{ep.name}</p>
                    {ep.overview && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ep.overview}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}