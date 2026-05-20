import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, BookmarkPlus, BookmarkCheck, Star, Clock, Calendar, Users, Clapperboard, Tv, ArrowLeft, FolderPlus, RotateCcw, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MediaRow from '../components/media/MediaRow';
import TrailerPlayer from '../components/media/TrailerPlayer';
import AddToCollectionDialog from '../components/media/AddToCollectionDialog';
import ImdbPanel from '../components/media/ImdbPanel';

export default function MediaDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const navigate = useNavigate();
  const mediaId = window.location.pathname.split('/media/')[1];
  const queryClient = useQueryClient();
  const [showPlayer, setShowPlayer] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [startAt, setStartAt] = useState(0);

  const saveProgress = useMutation({
    mutationFn: async ({ progressSeconds, totalSeconds, completed }) => {
      const existing = await base44.entities.WatchHistory.filter({ media_id: mediaId });
      const entry = existing[0];
      const data = {
        media_id: mediaId,
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
    enabled: !!mediaId,
  });

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
    staleTime: 5 * 60 * 1000,
  });

  const historyEntry = watchHistory.find(h => h.media_id === mediaId && !h.completed && h.progress_seconds > 30);

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list(),
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 100),
  });

  const isInWatchlist = watchlist.some(w => w.media_id === mediaId);

  const addToWatchlist = useMutation({
    mutationFn: () => base44.entities.Watchlist.create({ media_id: mediaId }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });
      const prev = queryClient.getQueryData(['watchlist']);
      queryClient.setQueryData(['watchlist'], (old = []) => [
        ...old,
        { id: '__optimistic__', media_id: mediaId },
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
      const item = watchlist.find(w => w.media_id === mediaId);
      if (item) await base44.entities.Watchlist.delete(item.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['watchlist'] });
      const prev = queryClient.getQueryData(['watchlist']);
      queryClient.setQueryData(['watchlist'], (old = []) =>
        old.filter(w => w.media_id !== mediaId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['watchlist'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const handlePlay = () => {
    if (media?.video_url && historyEntry?.progress_seconds > 30) {
      setResumePrompt(true);
    } else {
      setStartAt(0);
      setShowPlayer(true);
    }
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (isLoading || !media) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Similar media
  const similar = allMedia.filter(m =>
    m.id !== media.id &&
    m.media_type === media.media_type &&
    m.genre?.some(g => media.genre?.includes(g))
  ).slice(0, 10);

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh]">
        {(media.backdrop_url || media.poster_url) && (
          <img
            src={media.backdrop_url || media.poster_url}
            alt={media.title}
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

        {/* Trailer / video player overlay */}
        {showPlayer && (
          <TrailerPlayer media={media} startAt={startAt} onClose={() => setShowPlayer(false)} onProgress={(p) => saveProgress.mutate(p)} />
        )}

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
              {media.poster_url ? (
                <img src={media.poster_url} alt={media.title} className="w-full aspect-[2/3] object-cover" />
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
                {media.media_type === 'tv_show' ? 'TV Series' : 'Movie'}
              </Badge>
              {media.content_rating && (
                <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">
                  {media.content_rating}
                </Badge>
              )}
            </div>

            <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground mb-4">
              {media.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-5 flex-wrap">
              {media.rating && (
                <span className="flex items-center gap-1.5 text-foreground">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{media.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/10</span>
                </span>
              )}
              {media.year && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {media.year}
                </span>
              )}
              {media.duration_minutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(media.duration_minutes / 60)}h {media.duration_minutes % 60}m
                </span>
              )}
              {media.season_count && (
                <span className="flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" /> {media.season_count} Season{media.season_count > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Genres */}
            {media.genre?.length > 0 && (
              <div className="flex gap-2 mb-5 flex-wrap">
                {media.genre.map(g => (
                  <Badge key={g} variant="secondary" className="bg-secondary text-secondary-foreground text-xs rounded-full">
                    {g}
                  </Badge>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mb-8">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 px-6 rounded-xl font-semibold select-none"
                onClick={handlePlay}
              >
                <Play className="w-4 h-4 fill-current" />
                {media.video_url ? 'Play' : 'Watch Trailer'}
              </Button>
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
              <Link to={`/free-streams?q=${encodeURIComponent(media.title)}`}>
                <Button
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10 gap-2 h-11 px-5 rounded-xl select-none"
                >
                  <Zap className="w-4 h-4" /> Free Streams
                </Button>
              </Link>
            </div>
            <AddToCollectionDialog mediaId={mediaId} open={showCollections} onOpenChange={setShowCollections} />

            {/* IMDb Panel */}
            <ImdbPanel media={media} />

            {/* Description */}
            {media.description && (
              <div className="mb-8">
                <h3 className="font-heading font-semibold text-foreground mb-2">Overview</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{media.description}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {media.director && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Director</span>
                  <p className="text-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" /> {media.director}
                  </p>
                </div>
              )}
              {media.studio && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Studio</span>
                  <p className="text-foreground font-medium mt-0.5">{media.studio}</p>
                </div>
              )}
              {media.cast?.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" /> Cast
                  </span>
                  <p className="text-foreground text-sm">{media.cast.join(', ')}</p>
                </div>
              )}
            </div>
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