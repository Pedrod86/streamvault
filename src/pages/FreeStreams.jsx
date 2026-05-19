import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, ExternalLink, Play, Tv, Film, Zap, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FreeStreamPlayer from '@/components/media/FreeStreamPlayer';

const QUALITY_COLORS = {
  '4K': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  '1080p': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  '720p': 'bg-green-500/20 text-green-300 border-green-500/30',
  'HD': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'SD': 'bg-secondary text-muted-foreground border-border',
};

function QualityBadge({ quality }) {
  const cls = QUALITY_COLORS[quality] || QUALITY_COLORS['SD'];
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{quality || 'SD'}</span>
  );
}

export default function FreeStreams() {
  const initialQ = new URLSearchParams(window.location.search).get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchedTitle, setSearchedTitle] = useState('');
  const [playerUrl, setPlayerUrl] = useState(null);
  const [playerTitle, setPlayerTitle] = useState('');
  const [playerWatch, setPlayerWatch] = useState('');

  // Auto-search if navigated here with ?q=
  useEffect(() => {
    if (initialQ) {
      setQuery(initialQ);
      triggerSearch(initialQ);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSearch = async (title) => {
    if (!title.trim()) return;
    setLoading(true);
    setResults(null);
    setSearchedTitle(title.trim());
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Find free, legal streaming sources for "${title.trim()}". 
Search the web and return a list of places where this movie or TV show can be watched for free legally (e.g. Tubi, Pluto TV, Crackle, IMDb TV/Freevee, YouTube, Peacock free tier, Plex free, Kanopy, Hoopla, etc.).
For each source include:
- service: the platform name
- url: direct URL to watch the title on that service (not just the homepage)
- quality: video quality if known (4K, 1080p, 720p, HD, SD)
- requires_signup: true/false
- has_ads: true/false
- embed_url: if there is a YouTube or embeddable player URL, include it, otherwise null
- notes: any short note (e.g. "Free with library card", "Ad-supported", "Limited time")
Return only sources that are genuinely free (no paywall). If none are found, return an empty array.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          year: { type: 'string' },
          type: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                service: { type: 'string' },
                url: { type: 'string' },
                quality: { type: 'string' },
                requires_signup: { type: 'boolean' },
                has_ads: { type: 'boolean' },
                embed_url: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
        },
      },
    });
    setResults(res);
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    triggerSearch(query);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Free Stream Finder</h1>
          <p className="text-muted-foreground text-xs">Discover free, legal places to watch any movie or show</p>
        </div>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie or TV show..."
          className="bg-secondary border-border h-11 text-sm"
        />
        <Button type="submit" className="bg-primary hover:bg-primary/90 h-11 px-5 rounded-xl gap-2 shrink-0" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Find
        </Button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Searching free streaming platforms for <span className="text-foreground font-medium">"{searchedTitle}"</span>…</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Title info */}
            <div className="flex items-center gap-2 mb-4">
              {results.type === 'TV Show' || results.type === 'Series' ? (
                <Tv className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Film className="w-4 h-4 text-muted-foreground" />
              )}
              <h2 className="font-heading font-bold text-lg text-foreground">{results.title || searchedTitle}</h2>
              {results.year && <span className="text-muted-foreground text-sm">({results.year})</span>}
            </div>

            {!results.sources?.length ? (
              <div className="text-center py-12 bg-card border border-border rounded-xl">
                <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">No free streams found</p>
                <p className="text-muted-foreground text-sm mt-1">This title may only be available on paid services right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">{results.sources.length} free source{results.sources.length !== 1 ? 's' : ''} found</p>
                {results.sources.map((src, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
                  >
                    {/* Icon placeholder */}
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-foreground text-sm">{src.service}</span>
                        {src.quality && <QualityBadge quality={src.quality} />}
                        {src.has_ads && (
                          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Ads</span>
                        )}
                        {src.requires_signup && (
                          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Sign-up</span>
                        )}
                      </div>
                      {src.notes && (
                        <p className="text-xs text-muted-foreground">{src.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {src.embed_url && (
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 rounded-lg gap-1.5 h-8 px-3 text-xs"
                          onClick={() => { setPlayerUrl(src.embed_url); setPlayerTitle(results.title || searchedTitle); setPlayerWatch(src.url); }}
                        >
                          <Play className="w-3 h-3 fill-current" /> Play
                        </Button>
                      )}
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="border-border rounded-lg gap-1.5 h-8 px-3 text-xs">
                            <ExternalLink className="w-3 h-3" /> Watch
                          </Button>
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline player */}
      {playerUrl && (
        <FreeStreamPlayer
          title={playerTitle}
          embedUrl={playerUrl}
          watchUrl={playerWatch}
          onClose={() => setPlayerUrl(null)}
        />
      )}
    </div>
  );
}