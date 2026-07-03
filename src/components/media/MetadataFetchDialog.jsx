import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, CheckCircle2, Film, Tv2, AlertCircle } from 'lucide-react';

/**
 * Fetch metadata for a media item by searching TMDB or TVDB,
 * then apply the chosen result back onto the Media record.
 */
export default function MetadataFetchDialog({ open, onOpenChange, media }) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState('tmdb'); // tmdb | tvdb
  const [query, setQuery] = useState(media?.title || '');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const tvType = media?.media_type === 'tv_show' ? 'tv' : 'movie';

  const runSearch = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setDone(false);
    try {
      if (source === 'tmdb') {
        const res = await base44.functions.invoke('tmdbLookup', {
          action: 'search',
          query: query.trim(),
          media_type: tvType,
        });
        if (res.data?.error) throw new Error(res.data.error);
        const mapped = (res.data.results || [])
          .filter(r => r.title)
          .map(r => ({
            title: r.title,
            year: r.year,
            overview: r.overview,
            poster: r.poster || r.poster_thumb,
            rating: r.rating,
            genres: null,
          }));
        setResults(mapped);
      } else {
        const res = await base44.functions.invoke('tvdbLookup', {
          title: query.trim(),
          year: media?.year,
          type: media?.media_type,
        });
        if (res.data?.error) throw new Error(res.data.error);
        const d = res.data;
        setResults([{
          title: d.title,
          year: d.year,
          overview: d.overview,
          poster: d.poster,
          backdrop: d.backdrop,
          rating: d.rating,
          genres: d.genres,
        }]);
      }
    } catch (e) {
      setError(e.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const applyResult = async (r) => {
    setApplying(true);
    setError('');
    try {
      const patch = {};
      if (r.title) patch.title = r.title;
      if (r.overview) patch.description = r.overview;
      if (r.poster) patch.poster_url = r.poster;
      if (r.backdrop) patch.backdrop_url = r.backdrop;
      if (r.year) patch.year = parseInt(r.year, 10) || undefined;
      if (r.rating) patch.rating = Number(r.rating);
      if (r.genres?.length) patch.genre = r.genres;
      await base44.entities.Media.update(media.id, patch);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setDone(true);
      setTimeout(() => onOpenChange(false), 1200);
    } catch (e) {
      setError(e.message || 'Could not apply metadata.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Search className="w-4 h-4 text-primary" /> Fetch Metadata
          </DialogTitle>
        </DialogHeader>

        {/* Source toggle */}
        <div className="flex gap-2">
          <Button
            variant={source === 'tmdb' ? 'default' : 'outline'}
            className="flex-1 h-9"
            onClick={() => setSource('tmdb')}
          >
            TMDB
          </Button>
          <Button
            variant={source === 'tvdb' ? 'default' : 'outline'}
            className="flex-1 h-9"
            onClick={() => setSource('tvdb')}
          >
            TVDB
          </Button>
        </div>

        {/* Search box */}
        <div className="space-y-1.5">
          <Label className="text-sm text-foreground">Search title</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="e.g. The Matrix"
              className="bg-secondary border-border h-10"
            />
            <Button className="h-10 px-4 gap-1.5" onClick={runSearch} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {done && (
          <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Metadata applied!
          </div>
        )}

        {/* Results */}
        <div className="space-y-2">
          {results.map((r, idx) => (
            <button
              key={idx}
              type="button"
              disabled={applying}
              onClick={() => applyResult(r)}
              className="w-full flex gap-3 p-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-left transition-colors disabled:opacity-50"
            >
              <div className="w-12 h-[72px] rounded-md overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                {r.poster ? (
                  <img src={r.poster} alt={r.title} className="w-full h-full object-cover" />
                ) : (
                  tvType === 'tv' ? <Tv2 className="w-5 h-5 text-muted-foreground" /> : <Film className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{r.title}{r.year ? ` (${r.year})` : ''}</p>
                {r.overview && <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{r.overview}</p>}
              </div>
            </button>
          ))}
          {!loading && !error && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Search to find and apply metadata.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}