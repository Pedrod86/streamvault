import React from 'react';

// Decade buckets — each maps to a comma-separated list of years for Emby's Years param
const CURRENT_YEAR = new Date().getFullYear();
const DECADES = [
  { label: '2020s', start: 2020 },
  { label: '2010s', start: 2010 },
  { label: '2000s', start: 2000 },
  { label: '1990s', start: 1990 },
  { label: '1980s', start: 1980 },
  { label: '1970s', start: 1970 },
  { label: 'Older', start: 0 },
].map(d => {
  const end = d.start === 0 ? 1969 : d.start + 9;
  const from = d.start === 0 ? 1900 : d.start;
  const years = [];
  for (let y = from; y <= Math.min(end, CURRENT_YEAR); y++) years.push(y);
  return { ...d, years: years.join(',') };
});

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:bg-secondary/70'
      }`}
    >
      {children}
    </button>
  );
}

export default function LibraryFilterBar({ genres = [], genre, onGenreChange, years, onYearsChange }) {
  return (
    <div className="space-y-2.5 mb-6">
      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <Chip active={!genre} onClick={() => onGenreChange('')}>All Genres</Chip>
          {genres.map(g => (
            <Chip key={g} active={genre === g} onClick={() => onGenreChange(g)}>{g}</Chip>
          ))}
        </div>
      )}

      {/* Decade chips */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Chip active={!years} onClick={() => onYearsChange('')}>All Years</Chip>
        {DECADES.map(d => (
          <Chip key={d.label} active={years === d.years} onClick={() => onYearsChange(d.years)}>{d.label}</Chip>
        ))}
      </div>
    </div>
  );
}