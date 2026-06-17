import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tmdb, fanart } from '@/lib/metadataService';
import { X, Star, Clock, Calendar, ExternalLink, Loader2, Tv2, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CastAvatar({ member }) {
  return (
    <div className="shrink-0 w-16 text-center">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary mx-auto mb-1">
        {member.photo ? (
          <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-muted-foreground">
            {member.name?.[0]}
          </div>
        )}
      </div>
      <p className="text-[10px] text-foreground font-medium line-clamp-1">{member.name}</p>
      <p className="text-[10px] text-muted-foreground line-clamp-1">{member.character}</p>
    </div>
  );
}

export default function TmdbDetailSheet({ item, onClose }) {
  const type = item?.media_type === 'tv' ? 'tv' : 'movie';

  const { data: details, isLoading } = useQuery({
    queryKey: ['tmdb_details', item?.tmdb_id, type],
    queryFn: () => tmdb.details(item.tmdb_id, type),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!item?.tmdb_id,
  });

  const { data: fanartData } = useQuery({
    queryKey: ['fanart', item?.tmdb_id, type],
    queryFn: () => type === 'movie' ? fanart.movie(item.tmdb_id) : fanart.tv(item.tmdb_id),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!item?.tmdb_id,
  });

  if (!item) return null;

  const backdrop = details?.backdrop || item.backdrop;
  const poster = details?.poster || item.poster;
  const clearLogo = fanartData?.clearlogos?.[0]?.url;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] bg-card rounded-t-2xl sm:rounded-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Hero backdrop */}
        <div className="relative h-48 sm:h-64 bg-secondary shrink-0">
          {backdrop && (
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {poster && (
            <div className="absolute bottom-3 left-4 w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden shadow-xl border border-border">
              <img src={poster} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-6 space-y-4">
          {/* Title */}
          <div className="pl-24 sm:pl-28 -mt-2 min-h-[52px]">
            {clearLogo ? (
              <img src={clearLogo} alt={details?.title || item.title} className="max-h-10 max-w-[200px] object-contain" />
            ) : (
              <h2 className="font-heading font-bold text-lg text-foreground leading-tight">{details?.title || item.title}</h2>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {details && (
            <>
              {/* Meta row */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                {details.rating > 0 && (
                  <span className="flex items-center gap-1 text-amber-400 font-semibold">
                    <Star className="w-3 h-3 fill-amber-400" /> {details.rating?.toFixed(1)}
                  </span>
                )}
                {details.year && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{details.year}</span>}
                {details.runtime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{details.runtime}m</span>}
                {type === 'tv' && details.season_count && (
                  <span className="flex items-center gap-1"><Tv2 className="w-3 h-3" />{details.season_count} seasons</span>
                )}
                {type === 'movie' && <span className="flex items-center gap-1"><Film className="w-3 h-3" />Movie</span>}
                {details.status && <span className="px-2 py-0.5 rounded bg-secondary">{details.status}</span>}
              </div>

              {/* Genres */}
              {details.genres?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {details.genres.map(g => (
                    <span key={g} className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{g}</span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {details.overview && (
                <p className="text-sm text-muted-foreground leading-relaxed">{details.overview}</p>
              )}

              {/* Networks / Studios */}
              {(details.networks?.length > 0 || details.production_companies?.length > 0) && (
                <div className="flex gap-3 items-center flex-wrap">
                  {[...(details.networks || []), ...(details.production_companies || [])].slice(0, 4).map((n, i) => (
                    n.logo ? (
                      <img key={i} src={n.logo} alt={n.name} className="h-5 object-contain opacity-60" />
                    ) : (
                      <span key={i} className="text-xs text-muted-foreground">{n.name}</span>
                    )
                  ))}
                </div>
              )}

              {/* Cast */}
              {details.cast?.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Cast</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {details.cast.map((c, i) => <CastAvatar key={i} member={c} />)}
                  </div>
                </div>
              )}

              {/* Season posters from Fanart */}
              {fanartData?.season_posters?.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Season Art</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {fanartData.season_posters.filter(s => s.season !== '0').slice(0, 8).map((s, i) => (
                      <div key={i} className="shrink-0 w-16 text-center">
                        <img src={s.url} alt={`Season ${s.season}`} className="w-16 h-24 object-cover rounded-lg" />
                        <p className="text-[10px] text-muted-foreground mt-1">S{s.season}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disc art from Fanart */}
              {fanartData?.disc_art?.[0]?.url && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Disc Art</h3>
                  <img src={fanartData.disc_art[0].url} alt="Disc" className="w-32 h-32 object-contain mx-auto opacity-80" />
                </div>
              )}

              {/* Trailers */}
              {details.trailers?.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Trailers</h3>
                  <div className="flex gap-2 flex-wrap">
                    {details.trailers.slice(0, 3).map((t, i) => (
                      <a key={i} href={t.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors">
                        <ExternalLink className="w-3 h-3" /> {t.name || 'Trailer'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}