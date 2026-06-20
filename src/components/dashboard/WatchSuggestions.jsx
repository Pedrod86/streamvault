import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, Play, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Suggests what to watch next based on the user's watch history.
// Pulls recent history + the Emby library, then asks the LLM to pick the best matches.
export default function WatchSuggestions({ onAddToPlan }) {
  const navigate = useNavigate();

  const { data: history = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 50),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const watchedTitles = React.useMemo(() => {
    const ids = new Set(history.map(h => h.media_id));
    return allMedia
      .filter(m => ids.has(m.id) || history.some(h => h.media_id === `emby:${m.emby_id}`))
      .map(m => ({ title: m.title, genre: m.genre, media_type: m.media_type }));
  }, [history, allMedia]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['watchSuggestions', watchedTitles.length, allMedia.length],
    enabled: allMedia.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const library = allMedia.slice(0, 200).map(m => ({
        id: m.id, title: m.title, genre: m.genre || [], media_type: m.media_type,
      }));
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a TV & movie recommendation engine for a personal media library.
The user has recently watched these titles: ${JSON.stringify(watchedTitles.slice(0, 20))}.
From the following library, pick up to 8 titles the user is most likely to enjoy next, based on genre and type overlap. Do NOT pick titles they already watched. Library: ${JSON.stringify(library)}.
Return only items that exist in the library, referencing their exact id.`,
        response_json_schema: {
          type: 'object',
          properties: {
            picks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const picks = res?.picks || [];
      return picks
        .map(p => {
          const m = allMedia.find(x => x.id === p.id);
          return m ? { ...m, reason: p.reason } : null;
        })
        .filter(Boolean);
    },
  });

  if (allMedia.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h2 className="font-heading font-bold text-base text-foreground">Suggested For You</h2>
        <span className="text-xs text-muted-foreground ml-1">based on your history</span>
      </div>

      {isLoading ? (
        <div className="flex gap-3 px-4 sm:px-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="w-[140px] h-[210px] rounded-xl bg-secondary shrink-0" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="px-4 sm:px-6 text-sm text-muted-foreground">
          Watch a few titles and we'll suggest what to see next.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-2" style={{ scrollbarWidth: 'none' }}>
          {suggestions.map(item => (
            <div key={item.id} className="shrink-0 w-[140px] sm:w-[160px] group">
              <div
                className="relative rounded-xl overflow-hidden bg-secondary aspect-[2/3] mb-2 cursor-pointer"
                onClick={() => navigate(`/media/${item.id}`)}
              >
                {item.poster_url ? (
                  <img src={item.poster_url} alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  </div>
                </div>
                {onAddToPlan && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToPlan(item); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-primary flex items-center justify-center text-white transition-colors"
                    title="Add to weekly plan"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground font-medium truncate leading-tight">{item.title}</p>
              {item.reason && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}