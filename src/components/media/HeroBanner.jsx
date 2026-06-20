import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Info, Star, Clock, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function HeroBanner({ featured }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!featured || featured.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featured]);

  if (!featured || featured.length === 0) return null;

  const media = featured[current] ?? featured[0];
  if (!media) return null;

  // For live Emby items, pass title/poster/type so the detail page renders
  // without a DB record.
  const detailUrl = String(media.id).startsWith('emby:')
    ? `/media/${media.id}?${new URLSearchParams({
        type: media.media_type === 'tv_show' ? 'Series' : 'Movie',
        title: media.title || '',
        ...(media.poster_url ? { poster: media.poster_url } : {}),
      }).toString()}`
    : `/media/${media.id}`;

  return (
    <div className="relative h-[65vh] sm:h-[70vh] lg:h-[80vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={media.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {media.backdrop_url ? (
            <img
              src={media.backdrop_url}
              alt={media.title}
              className="w-full h-full object-cover"
            />
          ) : media.poster_url ? (
            <img
              src={media.poster_url}
              alt={media.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Gradients — deeper Plex-style bottom fade for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-16 max-w-[1400px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={media.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider bg-primary/90 text-primary-foreground px-2 py-0.5 rounded">
                {media.media_type === 'tv_show' ? 'Series' : 'Movie'}
              </span>
              {media.content_rating && (
                <span className="text-xs font-medium text-muted-foreground border border-muted-foreground/30 px-1.5 py-0.5 rounded">
                  {media.content_rating}
                </span>
              )}
            </div>

            <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-7xl text-foreground mb-3 max-w-3xl leading-[0.95] tracking-tight drop-shadow-lg">
              {media.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              {media.rating && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {media.rating.toFixed(1)}
                </span>
              )}
              {media.year && <span>{media.year}</span>}
              {media.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(media.duration_minutes / 60)}h {media.duration_minutes % 60}m
                </span>
              )}
              {media.genre?.length > 0 && (
                <span className="hidden sm:inline">{media.genre.slice(0, 3).join(' · ')}</span>
              )}
            </div>

            <p className="text-sm sm:text-base text-muted-foreground/90 max-w-xl mb-6 line-clamp-2 sm:line-clamp-3">
              {media.description}
            </p>

            <div className="flex items-center gap-3">
              <Link to={detailUrl}>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/30">
                  <Play className="w-5 h-5 fill-current" />
                  Play Now
                </Button>
              </Link>
              <Link to={detailUrl}>
                <Button variant="outline" className="border-foreground/20 bg-foreground/5 backdrop-blur-md text-foreground hover:bg-foreground/15 gap-2 h-12 px-8 rounded-xl font-bold">
                  <Info className="w-5 h-5" />
                  Details
                </Button>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        {featured.length > 1 && (
          <div className="flex items-center gap-2 mt-6">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === current ? 'w-8 bg-primary' : 'w-3 bg-foreground/20 hover:bg-foreground/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}