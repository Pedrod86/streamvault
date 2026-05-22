import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MediaCard({ media, showProgress, progress }) {
  const progressPercent =
    progress && progress.total_seconds > 0
      ? Math.min(100, Math.round((progress.progress_seconds / progress.total_seconds) * 100))
      : 0;

  const remainingSecs =
    progress && progress.total_seconds > 0
      ? Math.max(0, progress.total_seconds - progress.progress_seconds)
      : 0;

  const remainingLabel = remainingSecs > 60
    ? `${Math.round(remainingSecs / 60)}m left`
    : remainingSecs > 0 ? `<1m left` : null;

  return (
    <Link to={`/media/${media.id}`} className="block group">
      <motion.div
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{ duration: 0.2 }}
        className="relative rounded-xl overflow-hidden bg-card border border-border/50 shadow-lg shadow-black/20"
      >
        {/* Poster */}
        <div className="aspect-[2/3] relative overflow-hidden">
          {media.poster_url ? (
            <img
              src={media.poster_url}
              alt={media.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Play className="w-10 h-10 text-muted-foreground" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
            </div>
          </div>

          {/* Rating badge */}
          {media.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-semibold text-white">{media.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/80 backdrop-blur-sm text-primary-foreground px-1.5 py-0.5 rounded">
              {media.media_type === 'tv_show' ? 'Series' : 'Movie'}
            </span>
          </div>

          {/* Progress bar + time remaining */}
          {showProgress && progress && !progress.completed && progressPercent > 0 && (
            <>
              {remainingLabel && (
                <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded font-medium">
                  {remainingLabel}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div
                  className="h-full bg-primary rounded-r-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-heading font-semibold text-sm text-foreground truncate">{media.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {media.year && <span className="text-xs text-muted-foreground">{media.year}</span>}
            {media.genre?.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">{media.genre[0]}</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}