import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, BookmarkPlus, BookmarkCheck, Star, Clock, Calendar, Users, Clapperboard, Tv, ArrowLeft, FolderPlus, RotateCcw, Subtitles, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MediaRow from '../components/media/MediaRow';
import ExoPlayer from '@/components/media/ExoPlayer';
import EmbySeriesBrowser from '@/components/media/EmbySeriesBrowser';
import AddToCollectionDialog from '../components/media/AddToCollectionDialog';
import WatchProgressControls from '@/components/media/WatchProgressControls';
import TvdbPanel from '../components/media/TvdbPanel';
import TmdbCastInfo from '../components/media/TmdbCastInfo';
import PlaySourcePicker from '../components/media/PlaySourcePicker';
import PlexSeriesBrowser from '@/components/media/PlexSeriesBrowser';
import { getVodStreams, getVodStreamUrl } from '../lib/xtreamApi';

export default function MediaDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const navigate = useNavigate();
  const rawId = window.location.pathname.split('/media/')[1];
  const isEmbyDirect = rawId?.startsWith('emby:');
  const isJellyfinDirect = rawId?.startsWith('jellyfin:');
  const isPlexDirect = rawId?.startsWith('plex:');
  const embyDirectId = isEmbyDirect ? rawId.slice(5) : null;
  const jellyfinDirectId = isJellyfinDirect ? rawId.slice(9) : null;
  const plexDirectId = isPlexDirect ? rawId.slice(5) : null;
  const mediaId = (isEmbyDirect || isJellyfinDirect || isPlexDirect) ? null : rawId;
  const queryClient = useQueryClient();
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerSource, setPlayerSource] = useState('emby'); // 'emby' | 'iptv'
  const [showCollections, setShowCollections] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [embySubtitles, setEmbySubtitles] = useState([]); // loaded from Emby PlaybackInfo
  const [selectedSubIndex, setSelectedSubIndex] = useState(-1);
  const [showSubPicker, setShowSubPicker] = useState(false);

  // Key used for Watchlist / WatchHistory. For live Emby items we key on the
  // Emby item id (prefixed) so saved state survives without a DB record.
  const historyKey = isEmbyDirect ? `emby:${embyDirectId}` : mediaId;

  const saveProgress = useMutation({
    mutationFn: async ({ progressSeconds, totalSeconds, completed }) => {
      const existing = await base44.entities.WatchHistory.filter({ media_id: historyKey });
      const entry = existing[0];
      const data = {
        media_id: historyKey,
        progress_seconds: progressSeconds,
        total_seconds: totalSeconds,
        completed,
        last_watched: new Date().toISOString(),
      };
      if (entry) {
        return base44.entities.WatchHistory.update(entry.id, data);
      } else {
        return base44.entities.WatchHistory.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchHistory'] }),
  });

  const { data: media, isLoading } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: async () => {
      const items = await base44.entities.Media.filter({ id: mediaId });
      return items[0];
    },
    enabled: !!mediaId && !isEmbyDirect && !isJellyfinDirect && !isPlexDirect,
  });

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
    staleTime: 5 * 60 * 1000,
  });

  const historyEntry = watchHistory.find(h => h.media_id === historyKey && !h.completed && h.progress_seconds > 30);

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list(),
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 100),
  });

  // Emby server + library for direct playback
  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });
  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
  const jellyfinServer = servers.find(s => s.server_type === 'jellyfin' && s.is_active !== false);
  const xtreamServer = servers.find(s => s.server_type === 'xtream' && s.is_active !== false);

  const getJellyfinIdFromMedia = (item) => {
    if (!item) return null;
    const tagId = (item.tags || []).find(t => t?.startsWith('jellyfin:') && t !== 'jellyfin')?.replace('jellyfin:', '');
    return item.jellyfin_id || tagId || null;
  };
  // For jellyfin-direct links the id comes straight from the URL; otherwise from the saved record.
  const jellyfinId = jellyfinDirectId || getJellyfinIdFromMedia(media);
  // A title is playable on Jellyfin when we have both a Jellyfin server and its item id.
  const hasJellyfin = !!(jellyfinServer && jellyfinId);

  const getEmbyIdFromMedia = (item) => {
    if (!item) return null;
    const tagId = (item.tags || []).find(t => t?.startsWith('emby:') && t !== 'emby')?.replace('emby:', '');
    const urlId = (item.video_url || '').match(/\/Videos\/([^/]+)\//)?.[1];
    return item.emby_id || tagId || urlId || null;
  };

  const directType = urlParams.get('type') || 'Movie';
  const directTitle = urlParams.get('title') || 'Untitled';
  const directPoster = urlParams.get('poster') || null;

  // Build a lightweight Emby item from the saved media record instead of loading the full server library.
  const embyItem = embyDirectId
    ? { id: embyDirectId, title: directTitle, type: directType, posterUrl: directPoster }
    : media && getEmbyIdFromMedia(media) ? {
        id: getEmbyIdFromMedia(media),
        title: media.title,
        type: media.media_type === 'tv_show' ? 'Series' : 'Movie',
      } : null;

  // Try to find a matching VOD in IPTV by title
  const { data: iptvVod = null } = useQuery({
    queryKey: ['iptvVodMatch', xtreamServer?.id, media?.title],
    enabled: !!xtreamServer && !!media,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const streams = await getVodStreams(xtreamServer);
      if (!Array.isArray(streams) || !media?.title) return null;
      const q = media.title.toLowerCase().trim();
      return streams.find(s => s?.name?.toLowerCase?.().trim() === q) || null;
    },
  });

  // Resolve the direct-play stream URL for a Plex movie (shows use the browser).
  const isPlexShow = isPlexDirect && directType === 'Series';
  const { data: plexStreamUrl = null } = useQuery({
    queryKey: ['plexPlayback', plexDirectId],
    enabled: isPlexDirect && !isPlexShow,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await base44.functions.invoke('plexPlayback', { ratingKey: plexDirectId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data.streamUrl;
    },
  });

  // Fetch the item's own overview + metadata from the Emby/Jellyfin server
  // (mirrors how Plex surfaces its overview) so the detail page shows it directly.
  const detailServer = isEmbyDirect ? embyServer : (isJellyfinDirect ? jellyfinServer : null);
  const detailItemId = isEmbyDirect ? embyDirectId : (isJellyfinDirect ? jellyfinDirectId : null);
  const { data: serverItemDetail = null } = useQuery({
    queryKey: ['serverItemDetail', detailServer?.id, detailItemId],
    enabled: !!detailServer && !!detailItemId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const base = detailServer.server_url?.replace(/\/$/, '');
      const token = detailServer.api_token;
      // Resolve a user id (Emby/Jellyfin need it for item detail with Overview)
      let userId = null;
      try {
        const me = await fetch(`${base}/Users/Me?api_key=${token}`, { headers: { 'X-Emby-Token': token } }).then(r => r.json());
        userId = me?.Id || null;
      } catch (_) {}
      const url = userId
        ? `${base}/Users/${userId}/Items/${detailItemId}?api_key=${token}`
        : `${base}/Items/${detailItemId}?api_key=${token}`;
      const item = await fetch(url, { headers: { 'X-Emby-Token': token } }).then(r => r.json());
      return {
        overview: item?.Overview || '',
        year: item?.ProductionYear || null,
        rating: item?.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : null,
        genres: item?.Genres || [],
        duration: item?.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
        contentRating: item?.OfficialRating || null,
      };
    },
  });

  // Fetch subtitle tracks from Emby when item is known
  useEffect(() => {
    if (!embyItem || !embyServer) return;
    const base = embyServer.server_url?.replace(/\/$/, '');
    const token = embyServer.api_token;
    fetch(`${base}/Items/${embyItem.id}/PlaybackInfo?api_key=${token}`, {
      headers: { 'X-Emby-Token': token }
    })
      .then(r => r.json())
      .then(data => {
        const streams = data?.MediaSources?.[0]?.MediaStreams || [];
        const subs = streams
          .filter(s => s.Type === 'Subtitle')
          .map(s => ({ index: s.Index, label: s.DisplayTitle || s.Language || `Subtitle` }));
        setEmbySubtitles(subs);
      })
      .catch(() => {});
  }, [embyItem?.id, embyServer?.id]);

  const isInWatchlist = watchlist.some(w => w.media_id === historyKey);

  const addToWatchlist = useMutation({
    mutationFn: () => base44.entities.Watchlist.create({ media_id: historyKey }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });
      const prev = queryClient.getQueryData(['watchlist']);
      queryClient.setQueryData(['watchlist'], (old = []) => [
        ...old,
        { id: '__optimistic__', media_id: historyKey },
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['watchlist'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const removeFromWatchlist = useMutation({
    mutationFn: async () => {
      const item = watchlist.find(w => w.media_id === historyKey);
      if (item) await base44.entities.Watchlist.delete(item.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });
      const prev = queryClient.getQueryData(['watchlist']);
      queryClient.setQueryData(['watchlist'], (old = []) =>
        old.filter(w => w.media_id !== historyKey)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['watchlist'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const resolveSource = (chosen) => {
    if (chosen === 'jellyfin' && hasJellyfin) return 'jellyfin';
    if (chosen === 'emby' && embyItem) return 'emby';
    if (embyItem) return 'emby';
    if (hasJellyfin) return 'jellyfin';
    return 'iptv';
  };

  const handlePlay = (chosen) => {
    setPlayerSource(resolveSource(chosen));
    if (historyEntry?.progress_seconds > 30) {
      setResumePrompt(true);
    } else {
      setStartAt(0);
      setShowPlayer(true);
    }
  };

  // Resume instantly — jump straight to the exact saved second, no prompt
  const handleResume = () => {
    setPlayerSource(embyItem ? 'emby' : 'iptv');
    setStartAt(historyEntry.progress_seconds);
    setShowPlayer(true);
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // For emby-direct links, build a display object from the embyItem
  const activeMedia = isEmbyDirect
    ? (embyItem && embyItem.title !== 'Loading…' ? {
        id: null,
        title: embyItem.title,
        media_type: embyItem.type === 'Series' ? 'tv_show' : 'movie',
        poster_url: embyItem.posterUrl,
        backdrop_url: embyItem.backdropUrl,
        year: embyItem.year || serverItemDetail?.year,
        rating: embyItem.rating || serverItemDetail?.rating,
        duration_minutes: embyItem.duration || serverItemDetail?.duration,
        content_rating: serverItemDetail?.contentRating || undefined,
        genre: embyItem.genres?.length ? embyItem.genres : (serverItemDetail?.genres || []),
        description: embyItem.overview || serverItemDetail?.overview || '',
        video_url: embyItem.streamUrl,
      } : null)
    : isJellyfinDirect
    ? {
        id: null,
        title: directTitle,
        media_type: directType === 'Series' ? 'tv_show' : 'movie',
        poster_url: directPoster,
        year: serverItemDetail?.year,
        rating: serverItemDetail?.rating,
        duration_minutes: serverItemDetail?.duration,
        content_rating: serverItemDetail?.contentRating || undefined,
        genre: serverItemDetail?.genres || [],
        description: serverItemDetail?.overview || '',
      }
    : isPlexDirect
    ? {
        id: null,
        title: directTitle,
        media_type: directType === 'Series' ? 'tv_show' : 'movie',
        poster_url: directPoster,
        year: urlParams.get('year') ? Number(urlParams.get('year')) : undefined,
        genre: [],
        description: urlParams.get('overview') || '',
        video_url: plexStreamUrl || undefined,
      }
    : media;

  if (isLoading || !activeMedia) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Similar media
  const similar = allMedia.filter(m =>
    m.id !== activeMedia.id &&
    m.media_type === activeMedia.media_type &&
    m.genre?.some(g => activeMedia.genre?.includes(g))
  ).slice(0, 10);

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh]">
        {(activeMedia.backdrop_url || activeMedia.poster_url) && (
          <img
            src={activeMedia.backdrop_url || activeMedia.poster_url}
            alt={activeMedia.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        {/* Back button */}
        <div className="absolute top-4 left-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 select-none"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Video player */}
        {(() => {
          if (!showPlayer) return null;
          const PlayerComponent = ExoPlayer;
          // Plex series — browse seasons/episodes
          if (isPlexShow) {
            return (
              <PlexSeriesBrowser
                item={{ id: plexDirectId, title: activeMedia.title, poster_url: activeMedia.poster_url, year: activeMedia.year }}
                onClose={() => setShowPlayer(false)}
              />
            );
          }
          // TV series have no playable stream on the series id — browse episodes instead
          if (playerSource === 'emby' && embyItem && embyServer && activeMedia.media_type === 'tv_show') {
            return (
              <EmbySeriesBrowser
                item={{ ...embyItem, title: activeMedia.title, poster_url: activeMedia.poster_url, year: activeMedia.year }}
                server={embyServer}
                onClose={() => setShowPlayer(false)}
              />
            );
          }
          if (playerSource === 'emby' && embyItem && embyServer) {
            return (
              <PlayerComponent
                src={`${embyServer.server_url?.replace(/\/$/, '')}/Videos/${embyItem.id}/stream?api_key=${embyServer.api_token}&Static=true`}
                title={activeMedia.title}
                startAt={startAt}
                onClose={() => setShowPlayer(false)}
                onProgress={(p) => saveProgress.mutate(p)}
              />
            );
          }
          if (playerSource === 'jellyfin' && hasJellyfin && jellyfinServer && activeMedia.media_type === 'tv_show') {
            return (
              <EmbySeriesBrowser
                item={{ id: jellyfinId, title: activeMedia.title, type: 'Series', poster_url: activeMedia.poster_url, year: activeMedia.year }}
                server={jellyfinServer}
                onClose={() => setShowPlayer(false)}
              />
            );
          }
          if (playerSource === 'jellyfin' && hasJellyfin && jellyfinServer) {
            return (
              <PlayerComponent
                src={`${jellyfinServer.server_url?.replace(/\/$/, '')}/Videos/${jellyfinId}/stream?api_key=${jellyfinServer.api_token}&Static=true`}
                title={activeMedia.title}
                startAt={startAt}
                onClose={() => setShowPlayer(false)}
                onProgress={(p) => saveProgress.mutate(p)}
              />
            );
          }
          if (playerSource === 'iptv' && iptvVod && xtreamServer) {
            return (
              <PlayerComponent
                src={getVodStreamUrl(xtreamServer, iptvVod.stream_id, iptvVod.container_extension || 'mp4')}
                title={activeMedia.title}
                onClose={() => setShowPlayer(false)}
              />
            );
          }
          if (activeMedia.video_url) {
            return (
              <PlayerComponent
                src={activeMedia.video_url}
                title={activeMedia.title}
                startAt={startAt}
                onClose={() => setShowPlayer(false)}
                onProgress={(p) => saveProgress.mutate(p)}
              />
            );
          }
          return (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-6 text-center">
              <div>
                <p className="text-white text-lg font-semibold mb-2">No playable source</p>
                <p className="text-white/60 text-sm mb-5">This title isn't available to stream right now.</p>
                <Button onClick={() => setShowPlayer(false)} className="bg-primary hover:bg-primary/90 rounded-xl px-6">
                  Close
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Resume prompt */}
        <AnimatePresence>
          {resumePrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
              >
                <RotateCcw className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="font-heading font-bold text-lg text-foreground mb-1">Resume watching?</h3>
                <p className="text-muted-foreground text-sm mb-5">
                  You left off at <span className="text-foreground font-semibold">{formatTime(historyEntry.progress_seconds)}</span>
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-border rounded-xl"
                    onClick={() => { setResumePrompt(false); setStartAt(0); setShowPlayer(true); }}
                  >
                    Start Over
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 rounded-xl gap-2"
                    onClick={() => { setResumePrompt(false); setStartAt(historyEntry.progress_seconds); setShowPlayer(true); }}
                  >
                    <Play className="w-4 h-4 fill-current" /> Resume
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 -mt-40 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-8"
        >
          {/* Poster */}
          <div className="shrink-0 hidden lg:block">
            <div className="w-[240px] rounded-xl overflow-hidden shadow-2xl shadow-black/40 border border-border/50">
              {activeMedia.poster_url ? (
                <img src={activeMedia.poster_url} alt={activeMedia.title} className="w-full aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-secondary flex items-center justify-center">
                  <Play className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className="bg-primary/90 text-primary-foreground text-xs">
                {activeMedia.media_type === 'tv_show' ? 'TV Series' : 'Movie'}
              </Badge>
              {activeMedia.content_rating && (
                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">
                  {activeMedia.content_rating}
                </Badge>
              )}
            </div>

            <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground mb-4">
              {activeMedia.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5 flex-wrap">
              {activeMedia.rating && (
                <span className="flex items-center gap-1.5 text-foreground">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{activeMedia.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/10</span>
                </span>
              )}
              {activeMedia.year && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {activeMedia.year}
                </span>
              )}
              {activeMedia.duration_minutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(activeMedia.duration_minutes / 60)}h {activeMedia.duration_minutes % 60}m
                </span>
              )}
              {activeMedia.season_count && (
                <span className="flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" /> {activeMedia.season_count} Season{activeMedia.season_count > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Genres */}
            {activeMedia.genre?.length > 0 && (
              <div className="flex gap-2 mb-5 flex-wrap">
                {activeMedia.genre.map(g => (
                  <Badge key={g} variant="secondary" className="bg-secondary text-secondary-foreground text-xs rounded-full">
                    {g}
                  </Badge>
                ))}
              </div>
            )}

            {/* Playback options — only shown for Emby items */}
            {embyItem && embySubtitles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {/* Subtitles toggle */}
                {embySubtitles.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSubPicker(p => !p)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${subtitlesEnabled ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-secondary border-border text-foreground hover:bg-secondary/80'}`}
                    >
                      <Subtitles className="w-3.5 h-3.5" />
                      {subtitlesEnabled && selectedSubIndex !== -1
                        ? embySubtitles.find(s => s.index === selectedSubIndex)?.label || 'On'
                        : 'Subtitles'}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSubPicker && (
                      <div className="absolute top-10 left-0 w-56 bg-card border border-border rounded-xl overflow-hidden shadow-2xl z-30">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                          <span className="text-foreground text-sm font-semibold">Subtitles</span>
                          <button onClick={() => setShowSubPicker(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          <button onClick={() => { setSubtitlesEnabled(false); setSelectedSubIndex(-1); setShowSubPicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${!subtitlesEnabled ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}>
                            Off
                          </button>
                          {embySubtitles.map(s => (
                            <button key={s.index} onClick={() => { setSubtitlesEnabled(true); setSelectedSubIndex(s.index); setShowSubPicker(false); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${subtitlesEnabled && selectedSubIndex === s.index ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mb-8 flex-wrap">
              {historyEntry?.progress_seconds > 30 && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 px-6 rounded-xl font-semibold select-none"
                  onClick={handleResume}
                >
                  <RotateCcw className="w-4 h-4" />
                  Resume {formatTime(historyEntry.progress_seconds)}
                </Button>
              )}
              {isPlexDirect ? (
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 px-6 rounded-xl font-semibold select-none"
                  disabled={!isPlexShow && !plexStreamUrl}
                  onClick={() => { setStartAt(0); setShowPlayer(true); }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isPlexShow ? 'Play' : (plexStreamUrl ? 'Play' : 'Loading…')}
                </Button>
              ) : (
                <PlaySourcePicker
                  hasEmby={!!embyItem}
                  hasJellyfin={hasJellyfin && (activeMedia.media_type !== 'tv_show' || isJellyfinDirect)}
                  label={historyEntry?.progress_seconds > 30 ? 'Start Over' : (embyItem || hasJellyfin ? 'Play' : iptvVod ? 'Play with IPTV' : 'Play')}
                  onPlay={(chosen) => { setPlayerSource(resolveSource(chosen)); setStartAt(0); setShowPlayer(true); }}
                />
              )}
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-secondary gap-2 h-11 px-5 rounded-xl select-none"
                onClick={() => isInWatchlist ? removeFromWatchlist.mutate() : addToWatchlist.mutate()}
              >
                {isInWatchlist ? (
                  <><BookmarkCheck className="w-4 h-4 text-primary" /> In My List</>
                ) : (
                  <><BookmarkPlus className="w-4 h-4" /> Add to List</>
                )}
              </Button>
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-secondary gap-2 h-11 px-5 rounded-xl select-none"
                onClick={() => setShowCollections(true)}
              >
                <FolderPlus className="w-4 h-4" /> Collections
              </Button>
            </div>
            <AddToCollectionDialog mediaId={historyKey} open={showCollections} onOpenChange={setShowCollections} />

            {/* Manual watched toggle + progress control */}
            <WatchProgressControls
              historyKey={historyKey}
              durationMinutes={activeMedia.duration_minutes}
              historyEntry={watchHistory.find(h => h.media_id === historyKey)}
            />

            {/* TVDB Panel */}
            <TvdbPanel media={activeMedia} onEnriched={() => queryClient.invalidateQueries({ queryKey: ['media', mediaId] })} />

            {/* Description */}
            {activeMedia.description && (
              <div className="mb-8">
                <h3 className="font-heading font-semibold text-foreground mb-2">Overview</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{activeMedia.description}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {activeMedia.director && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Director</span>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" /> {activeMedia.director}
                  </p>
                </div>
              )}
              {activeMedia.studio && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Studio</span>
                  <p className="text-foreground font-medium mt-0.5">{activeMedia.studio}</p>
                </div>
              )}
            </div>

            {/* Rich cast & crew from TMDB */}
            <TmdbCastInfo
              title={activeMedia.title}
              year={activeMedia.year}
              mediaType={activeMedia.media_type}
            />
          </div>
        </motion.div>

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-12 pb-12">
            <MediaRow title="More Like This" items={similar} />
          </div>
        )}
      </div>
    </div>
  );
}