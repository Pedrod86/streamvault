import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import AudiobookPlayer from '@/components/audiobooks/AudiobookPlayer';

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function BookCard({ book, onPlay }) {
  return (
    <button
      onClick={() => onPlay(book)}
      className="flex gap-4 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-card/80 transition-all text-left w-full"
    >
      <div className="w-16 h-20 rounded-lg overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
        {book.posterUrl ? (
          <img src={book.posterUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-7 h-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 py-1 space-y-1">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{book.title}</h3>
        {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
        {book.narrator && <p className="text-xs text-muted-foreground">Narrated by {book.narrator}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {book.year && <span className="text-[11px] text-muted-foreground">{book.year}</span>}
          {book.durationSeconds > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {formatDuration(book.durationSeconds)}
            </span>
          )}
          {book.genres?.slice(0, 1).map(g => (
            <span key={g} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{g}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function Audiobooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [playingBook, setPlayingBook] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let all = [];
        let startIndex = 0;
        const pageSize = 100;
        while (true) {
          const res = await base44.functions.invoke('embyAudiobooks', { startIndex, pageSize });
          if (res.data?.error) throw new Error(res.data.error);
          const { items, hasMore } = res.data;
          all = [...all, ...(items || [])];
          if (!hasMore) break;
          startIndex += items.length;
        }
        setBooks(all);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = books.filter(b =>
    !search ||
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    b.narrator?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Audiobooks</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground">{books.length} titles from Emby</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, author or narrator…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary border-border h-11"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm">Loading audiobooks from Emby…</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 space-y-2">
          <p className="text-destructive text-sm">{error}</p>
          <p className="text-xs text-muted-foreground">Make sure your Emby server has an Audiobooks library and is connected.</p>
        </div>
      )}

      {!loading && !error && books.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No audiobooks found in your Emby library.</p>
          <p className="text-xs text-muted-foreground">Make sure your Emby server has an Audiobooks or Music library with audio content.</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && search && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No results for "{search}"
        </div>
      )}

      {/* Book list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(book => (
            <BookCard key={book.id} book={book} onPlay={setPlayingBook} />
          ))}
        </div>
      )}

      {/* Player overlay */}
      {playingBook && (
        <AudiobookPlayer book={playingBook} onClose={() => setPlayingBook(null)} />
      )}
    </div>
  );
}