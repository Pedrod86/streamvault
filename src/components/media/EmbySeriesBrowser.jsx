import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Play, ChevronRight, Loader2, Tv, Clock, CheckCircle2, Download } from 'lucide-react';
import ExoPlayer from './ExoPlayer';
import QualityBadge from './QualityBadge';
import DownloadedBadge from './DownloadedBadge';
import { useDownloads } from '@/hooks/useDownloads';

export default function EmbySeriesBrowser({ item, server, onClose }) {
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const { downloadedKeys, markDownloaded } = useDownloads();

  const downloadEpisode = async (ep, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (downloadingId) return;
    const base = server?.server_url?.replace(/\/$/, '');
    const token = server?.api_token;
    const url = `${base}/Videos/${ep.id}/stream?api_key=${token}&Static=true`;
    const key = `emby:${ep.id}`;
    setDownloadingId(ep.id);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${item.title} - ${ep.name || 'Episode'}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (_) {
      window.open(url, '_blank');
    }
    markDownloaded.mutate({ media_key: key, title: `${item.title} — ${ep.name || 'Episode'}`, media_type: 'episode', poster_url: ep.thumbUrl });
    setDownloadingId(null);
  };

  // Resolve the real Emby server ID from multiple possible sources.
  // MediaDetail passes the resolved id as `item.id`, so check that first.
  const embyId = item.id
    || item.embyId
    || item.emby_id
    || (item.tags || []).find(t => t?.startsWith('emby:') && t !== 'emby')?.replace('emby:', '')
    || (item.video_url || '').match(/\/Videos\/([^/]+)\//)?.[1];

  useEffect(() => {
    if (!embyId) {
      setError('Cannot browse this series — Emby ID not available. Try re-syncing your library.');
      setLoading(false);
      return;
    }
    setLoading(true);
    base44.functions.invoke('embyEpisodes', { seriesId: embyId })
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
  }, [embyId]);

  if (playingEpisode) {
    const base = server?.server_url?.replace(/\/$/, '');
    const token = server?.api_token;
    // Use an HLS transcode URL so the Android WebView can always decode episodes
    // (most series are MKV/H.265, which direct-play <video> can't handle in WebView).
    const id = playingEpisode.id;
    const src = `${base}/Videos/${id}/master.m3u8?api_key=${token}` +
      `&MediaSourceId=mediasource_${id}&DeviceId=streamvault-web&PlaySessionId=${Date.now()}` +
      `&VideoCodec=h264&AudioCodec=aac,mp3&TranscodingContainer=ts&TranscodingProtocol=hls` +
      `&EnableAdaptiveBitrateStreaming=true`;
    return (
      <ExoPlayer
        src={src}
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
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                    {(ep.quality || ep.codec) && (
                      <div className="absolute top-1 right-1">
                        <QualityBadge quality={ep.quality} codec={ep.codec} />
                      </div>
                    )}
                    {ep.progressPercent > 0 && !ep.played && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div className="h-full bg-primary" style={{ width: `${ep.progressPercent}%` }} />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="text-[10px] text-muted-foreground">
                        S{String(ep.seasonIndex).padStart(2, '0')}E{String(ep.episodeIndex).padStart(2, '0')}
                        {ep.durationMinutes ? ` · ${ep.durationMinutes}m` : ''}
                      </p>
                      {ep.played ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Watched
                        </span>
                      ) : ep.remainingMinutes != null ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-primary">
                          <Clock className="w-2.5 h-2.5" /> {ep.remainingMinutes}m left
                        </span>
                      ) : null}
                      {downloadedKeys.has(`emby:${ep.id}`) && <DownloadedBadge variant="inline" />}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{ep.name}</p>
                    {ep.overview && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ep.overview}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => downloadEpisode(ep, e)}
                    disabled={downloadingId === ep.id}
                    title={downloadedKeys.has(`emby:${ep.id}`) ? 'Downloaded — ready offline' : 'Download for offline'}
                    className={`shrink-0 p-2 rounded-lg transition-colors ${downloadedKeys.has(`emby:${ep.id}`) ? 'text-green-400' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                  >
                    {downloadingId === ep.id ? <Loader2 className="w-4 h-4 animate-spin" /> : downloadedKeys.has(`emby:${ep.id}`) ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  </button>
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