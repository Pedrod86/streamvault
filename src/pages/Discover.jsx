import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Play, ExternalLink, Loader2, Film, Tv2, Youtube, Archive } from 'lucide-react';
import FreeStreamPlayer from '@/components/media/FreeStreamPlayer';

const QUICK_SEARCHES = [
  'classic black and white movies',
  'Charlie Chaplin films',
  'public domain horror movies',
  'free sci-fi movies',
  'documentary films',
  'silent era films',
  'Buster Keaton comedies',
  'free animated movies',
];

export default function Discover() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(null); // { title, url, source }
  const [searched, setSearched] = useState(false);

  const search = async (q) => {
    const term = q || query;
    if (!term.trim()) return;
    setLoading(true);
    setResults([]);
    setSearched(true);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Find free, legal, embeddable movies or TV shows matching: "${term}".
Search for content on:
- YouTube (full free movies, documentaries, public domain content)
- Internet Archive (archive.org)
- Any other legal free streaming source

Return up to 12 results. For each result provide:
- title: exact title
- year: release year if known
- description: 1-2 sentence plot summary
- source: "youtube", "archive", or "other"
- embed_url: the DIRECT embeddable URL:
  * For YouTube: use https://www.youtube.com/embed/VIDEO_ID format
  * For Internet Archive: use https://archive.org/embed/IDENTIFIER format
  * For other sources: direct embed URL
- watch_url: the regular watch page URL (for "open in new tab")
- genre: main genre (e.g. "Comedy", "Horror", "Documentary")
- duration: approximate duration string e.g. "1h 32m"

Only include content that is genuinely free and legally embeddable. Prioritize well-known public domain classics and popular free content.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                year: { type: 'string' },
                description: { type: 'string' },
                source: { type: 'string' },
                embed_url: { type: 'string' },
                watch_url: { type: 'string' },
                genre: { type: 'string' },
                duration: { type: 'string' },
              },
            },
          },
        },
      },
    });

    setResults(res?.results || []);
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') search();
  };

  const sourceIcon = (source) => {
    if (source === 'youtube') return <Youtube className="w-3 h-3 text-red-400" />;
    if (source === 'archive') return <Archive className="w-3 h-3 text-amber-400" />;
    return <Film className="w-3 h-3 text-primary" />;
  };

  const sourceLabel = (source) => {
    if (source === 'youtube') return 'YouTube';
    if (source === 'archive') return 'Archive.org';
    return 'Free Stream';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {playing && (
        <FreeStreamPlayer
          title={playing.title}
          embedUrl={playing.embed_url}
          watchUrl={playing.watch_url}
          onClose={() => setPlaying(null)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-1 flex items-center gap-2">
            <Film className="w-7 h-7 text-primary" /> Discover Free Movies
          </h1>
          <p className="text-muted-foreground text-sm">
            Search for free, legal movies &amp; shows from YouTube, Internet Archive, and public domain sources.
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search free movies, genres, actors…"
              className="pl-9 bg-card border-border"
            />
          </div>
          <Button onClick={() => search()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
        </div>

        {/* Quick searches */}
        {!searched && (
          <div className="mb-8">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Quick searches</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((qs) => (
                <button
                  key={qs}
                  onClick={() => { setQuery(qs); search(qs); }}
                  className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {qs}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Searching free & legal streams…</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map((item, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
              >
                {/* Thumbnail placeholder with play overlay */}
                <div
                  className="relative aspect-video bg-secondary flex items-center justify-center cursor-pointer"
                  onClick={() => setPlaying(item)}
                >
                  {item.source === 'youtube' ? (
                    <Youtube className="w-10 h-10 text-red-400/40" />
                  ) : item.source === 'archive' ? (
                    <Archive className="w-10 h-10 text-amber-400/40" />
                  ) : (
                    <Film className="w-10 h-10 text-primary/40" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all">
                    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  {item.duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {item.duration}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
                      {item.title}
                    </h3>
                    {item.watch_url && (
                      <a
                        href={item.watch_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {sourceIcon(item.source)} {sourceLabel(item.source)}
                    </span>
                    {item.year && <span className="text-xs text-muted-foreground">· {item.year}</span>}
                    {item.genre && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                        {item.genre}
                      </Badge>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full mt-3 gap-1.5 h-8 text-xs"
                    onClick={() => setPlaying(item)}
                  >
                    <Play className="w-3 h-3" fill="currentColor" /> Watch Free
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <Tv2 className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">No results found. Try a different search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}