import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import MediaContextMenu from './MediaContextMenu';
import DownloadedBadge from './DownloadedBadge';
import { useDownloads } from '@/hooks/useDownloads';

export default function MediaCard({ media, showProgress, progress, disableNavigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { downloadedKeys } = useDownloads();
  const isDownloaded = downloadedKeys.has(media.id) || downloadedKeys.has(`emby:${media.id}`);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const startLongPress = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
    }, 550);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuOpen(true);
  };
  // Swallow the click that follows a long-press so navigation doesn't fire
  const handleClickCapture = (e) => {
    if (longPressFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFired.current = false;
    }
  };
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

  const Wrapper = disableNavigation
    ? ({ children, className }) => <div className={className}>{children}</div>
    : ({ children, className }) => <Link to={`/media/${media.id}`} className={className}>{children}</Link>;

  return (
    <>
    <Wrapper className="block group">
      <motion.div
        whileHover={{ scale: 1.06, y: -6 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onContextMenu={handleContextMenu}
        onClickCapture={handleClickCapture}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        className="relative rounded-xl overflow-hidden bg-card border border-border/50 shadow-lg shadow-black/20 transition-shadow duration-200 group-hover:shadow-2xl group-hover:shadow-primary/25 group-hover:border-primary/40"
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/40">
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
            </div>
          </div>

          {/* Metadata caption — fades in on hover */}
          <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
            <h4 className="font-heading font-semibold text-sm text-white truncate drop-shadow">{media.title}</h4>
            {(media.year || media.genre?.length > 0) && (
              <p className="text-[11px] text-white/70 truncate">
                {[media.year, media.genre?.[0]].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Rating badge */}
          {media.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-semibold text-white">{media.rating.toFixed(1)}</span>
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/80 backdrop-blur-sm text-primary-foreground px-1.5 py-0.5 rounded">
              {media.media_type === 'tv_show' ? 'Series' : 'Movie'}
            </span>
            {isDownloaded && <DownloadedBadge />}
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
    </Wrapper>
    <MediaContextMenu open={menuOpen} onOpenChange={setMenuOpen} media={media} />
    </>
  );
}