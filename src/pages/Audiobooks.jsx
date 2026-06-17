import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Search, Loader2, Download, CheckCircle, Play, Globe, ChevronRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AudiobookPlayer from '@/components/audiobooks/AudiobookPlayer';

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMins(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Emby book card ─────────────────────────────────────────────────────────────
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

// ── Online search result card ──────────────────────────────────────────────────
function OnlineBookCard({ book, onAdd, saving, saved }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-card border border-border text-left w-full">
      <div className="w-14 h-18 rounded-lg overflow-hidden bg-secondary shrink-0 flex items-center justify-center" style={{ minHeight: '72px' }}>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <BookOpen className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{book.title}</h3>
        {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {book.year && <span className="text-[11px] text-muted-foreground">{book.year}</span>}
          {book.runtime && <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{formatMins(book.runtime)}</span>}
          {book.language && book.language !== 'English' && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{book.language}</span>
          )}
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{book.license || 'Free'}</span>
        </div>
        {book.totalSections > 1 && (
          <p className="text-[11px] text-muted-foreground">{book.totalSections} chapters</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">
        {saved ? (
          <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:block">Saved</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10 h-8 px-3 text-xs gap-1"
            onClick={() => onAdd(book)}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            <span className="hidden sm:block">Add</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Audiobooks() {
  const [tab, setTab] = useState('library'); // 'library' | 'discover'

  // Library state (Emby)
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [playingBook, setPlayingBook] = useState(null);

  // Discover state
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverResults, setDiscoverResults] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [savingIds, setSavingIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());

  // Load Emby audiobooks — fetch first 100 immediately, then load more in background
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await base44.functions.invoke('embyAudiobooks', { startIndex: 0, pageSize: 100 });
        if (res.data?.error) throw new Error(res.data.error);
        const firstBatch = res.data?.items || [];
        setBooks(firstBatch);
        setLoading(false);

        // Load remaining pages in background
        if (res.data?.hasMore) {
          let startIdx = 100;
          while (true) {
            const more = await base44.functions.invoke('embyAudiobooks', { startIndex: startIdx, pageSize: 100 });
            if (more.data?.error) break;
            const batch = more.data?.items || [];
            if (!batch.length) break;
            setBooks(prev => [...prev, ...batch]);
            if (!more.data?.hasMore || batch.length < 100) break;
            startIdx += 100;
          }
        }
      } catch (e) {
        setError(e.message);
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

  // Search LibriVox
  const handleDiscover = async (e) => {
    e.preventDefault();
    if (!discoverQuery.trim()) return;
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoverResults([]);
    try {
      const res = await base44.functions.invoke('audiobookSearch', { query: discoverQuery.trim() });
      if (res.data?.error) throw new Error(res.data.error);
      setDiscoverResults(res.data?.results || []);
    } catch (err) {
      setDiscoverError(err.message);
    } finally {
      setDiscoverLoading(false);
    }
  };

  // Save a discovered book to library
  const handleSave = async (book) => {
    setSavingIds(prev => new Set([...prev, book.id]));
    try {
      const res = await base44.functions.invoke('audiobookSearch', {
        action: 'save',
        bookId: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        description: book.description,
        year: book.year,
        genres: book.genres,
        streamUrl: book.streamUrl || book.chapters?.[0]?.listen_url,
      });
      if (res.data?.success || res.data?.existing) {
        setSavedIds(prev => new Set([...prev, book.id]));
      } else if (res.data?.error) {
        alert(res.data.error);
      }
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(book.id); return s; });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BookOpen className="w-6 h-6 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-bold text-2xl text-foreground">Audiobooks</h1>
          {!loading && tab === 'library' && (
            <p className="text-sm text-muted-foreground">{books.length} titles from Emby</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('library')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'library' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          My Library
        </button>
        <button
          onClick={() => setTab('discover')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === 'discover' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="w-3.5 h-3.5" /> Discover & Add
        </button>
      </div>

      {/* ── LIBRARY TAB ── */}
      {tab === 'library' && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author or narrator…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border h-11"
            />
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm">Loading audiobooks from Emby…</span>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16 space-y-3">
              <p className="text-destructive text-sm">{error}</p>
              <p className="text-xs text-muted-foreground">Make sure your Emby server is connected and has an Audiobooks library.</p>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setTab('discover')}>
                <Globe className="w-3.5 h-3.5" /> Discover free audiobooks online
              </Button>
            </div>
          )}

          {!loading && !error && books.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No audiobooks found in your Emby library.</p>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setTab('discover')}>
                <Globe className="w-3.5 h-3.5" /> Search & add free audiobooks
              </Button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && search && (
            <div className="text-center py-12 text-muted-foreground text-sm">No results for "{search}"</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map(book => (
                <BookCard key={book.id} book={book} onPlay={setPlayingBook} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── DISCOVER TAB ── */}
      {tab === 'discover' && (
        <div className="space-y-5">
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1 flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary" /> Free Audiobooks via LibriVox</p>
            <p>Search thousands of free public domain audiobooks narrated by volunteers. Save any book to stream it directly in StreamVault.</p>
          </div>

          <form onSubmit={handleDiscover} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search title or author…"
                value={discoverQuery}
                onChange={e => setDiscoverQuery(e.target.value)}
                className="pl-9 bg-secondary border-border h-11"
              />
            </div>
            <Button type="submit" className="h-11 px-5 bg-primary hover:bg-primary/90 shrink-0" disabled={discoverLoading}>
              {discoverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </form>

          {discoverLoading && (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm">Searching LibriVox…</span>
            </div>
          )}

          {discoverError && (
            <p className="text-destructive text-sm text-center py-4">{discoverError}</p>
          )}

          {!discoverLoading && discoverResults.length === 0 && discoverQuery && !discoverError && (
            <div className="text-center py-12 text-muted-foreground text-sm">No results found for "{discoverQuery}"</div>
          )}

          {discoverResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{discoverResults.length} results — tap "Add" to save to your library</p>
              {discoverResults.map(book => (
                <OnlineBookCard
                  key={book.id}
                  book={book}
                  onAdd={handleSave}
                  saving={savingIds.has(book.id)}
                  saved={savedIds.has(book.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player overlay */}
      {playingBook && (
        <AudiobookPlayer book={playingBook} onClose={() => setPlayingBook(null)} />
      )}
    </div>
  );
}