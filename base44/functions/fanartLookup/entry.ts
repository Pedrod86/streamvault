import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FANART_BASE = 'https://webservice.fanart.tv/v3';

async function fanart(path) {
  const key = Deno.env.get('FANART_API_KEY');
  const url = `${FANART_BASE}${path}?api_key=${key}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`Fanart.tv ${r.status}`);
  }
  return r.json();
}

function best(arr, limit = 3) {
  if (!Array.isArray(arr)) return [];
  return arr
    .sort((a, b) => parseInt(b.likes || 0) - parseInt(a.likes || 0))
    .slice(0, limit)
    .map(i => ({ url: i.url, lang: i.lang, likes: parseInt(i.likes || 0) }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tmdb_id, tvdb_id, media_type = 'movie' } = await req.json();

    if (!tmdb_id && !tvdb_id) {
      return Response.json({ error: 'tmdb_id or tvdb_id required' }, { status: 400 });
    }

    let data = null;

    if (media_type === 'movie') {
      data = await fanart(`/movies/${tmdb_id}`);
      if (!data) return Response.json({ found: false });
      return Response.json({
        found: true,
        media_type: 'movie',
        posters: best(data.movieposter, 5),
        backdrops: best(data.moviebackground, 5),
        clearlogos: best(data.hdmovielogo || data.movielogo, 3),
        disc_art: best(data.moviedisc, 3),
        banners: best(data.moviebanner, 3),
        clearart: best(data.hdmovieart || data.movieart, 3),
        thumbnails: best(data.moviethumb, 3),
      });
    } else {
      // TV — fanart uses TVDB IDs for TV, fall back to tmdb_id search if needed
      const id = tvdb_id || tmdb_id;
      data = await fanart(`/tv/${id}`);
      if (!data) return Response.json({ found: false });
      return Response.json({
        found: true,
        media_type: 'tv',
        posters: best(data.tvposter, 5),
        backdrops: best(data.showbackground, 5),
        clearlogos: best(data.hdtvlogo || data.clearlogo, 3),
        banners: best(data.tvbanner, 3),
        clearart: best(data.hdclearart || data.clearart, 3),
        character_art: best(data.characterart, 3),
        season_posters: (() => {
          const sp = data.seasonposter;
          if (!Array.isArray(sp)) return [];
          return sp.map(i => ({ url: i.url, season: i.season, lang: i.lang }));
        })(),
        season_banners: (() => {
          const sb = data.seasonbanner;
          if (!Array.isArray(sb)) return [];
          return sb.map(i => ({ url: i.url, season: i.season, lang: i.lang }));
        })(),
      });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});