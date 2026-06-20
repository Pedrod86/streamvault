import React from 'react';
import { motion } from 'framer-motion';
import { Film, Tv2, LayoutGrid } from 'lucide-react';

// Plex-style two-tier filter: pick a type, then a genre underneath.
export default function CategoryFilters({
  typeFilter,
  onTypeChange,
  genreFilter,
  onGenreChange,
  genres,
}) {
  const types = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'movie', label: 'Movies', icon: Film },
    { id: 'tv_show', label: 'TV Shows', icon: Tv2 },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* Type selector with sliding highlight */}
      <div className="flex gap-2">
        {types.map(({ id, label, icon: Icon }) => {
          const active = typeFilter === id;
          return (
            <button
              key={id}
              onClick={() => onTypeChange(id)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="categoryTypePill"
                  className="absolute inset-0 bg-primary rounded-xl shadow-lg shadow-primary/30"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Genre chips */}
      {genres.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => onGenreChange('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              genreFilter === 'all'
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => onGenreChange(g)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                genreFilter === g
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {g}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}