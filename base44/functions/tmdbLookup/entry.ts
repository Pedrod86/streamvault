import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

function img(path, size = 'w500') {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

async function tmdb(path, params = {}) {
  const key = Deno.env.get('TMDB_API_KEY');
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`TMDb ${r.status}: ${await r.text()}`);
  return r.json();
}

function mapMovie(m) {
  return {
    tmdb_id: m.id,
    title: m.title || m.name,
    year: (m.release_date || m.first_air_date || '').slice(0, 4),
    overview: m.overview,
    poster: img(m.poster_path, 'w500'),
    poster_thumb: img(m.poster_path, 'w185'),
    backdrop: img(m.backdrop_path, 'w1280'),
    backdrop_thumb: img(m.backdrop_path, 'w780'),
    rating: m.vote_average,
    vote_count: m.vote_count,
    popularity: m.popularity,
    genre_ids: m.genre_ids,
    media_type: m.media_type || (m.title ? 'movie' : 'tv'),
  };
}

function mapDetails(d, type) {
  const base = {
    tmdb_id: d.id,
    title: d.title || d.name,
    original_title: d.original_title || d.original_name,
    year: (d.release_date || d.first_air_date || '').slice(0, 4),
    overview: d.overview,
    tagline: d.tagline,
    poster: img(d.poster_path, 'w500'),
    poster_original: img(d.poster_path, 'original'),
    poster_thumb: img(d.poster_path, 'w185'),
    backdrop: img(d.backdrop_path, 'w1280'),
    backdrop_original: img(d.backdrop_path, 'original'),
    rating: d.vote_average,
    runtime: d.runtime || (d.episode_run_time?.[0]),
    genres: d.genres?.map(g => g.name),
    production_companies: d.production_companies?.map(c => ({
      name: c.name,
      logo: img(c.logo_path, 'w185'),
    })),
    networks: d.networks?.map(n => ({
      name: n.name,
      logo: img(n.logo_path, 'w185'),
    })),
    homepage: d.homepage,
    status: d.status,
    popularity: d.popularity,
  };
  if (type === 'tv') {
    base.season_count = d.number_of_seasons;
    base.episode_count = d.number_of_episodes;
    base.seasons = d.seasons?.map(s => ({
      number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      poster: img(s.poster_path, 'w342'),
      air_date: s.air_date,
    }));
  }
  return base;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, query, tmdb_id, media_type = 'movie', page = 1, language = 'en-US' } = await req.json();

    // ── trending ──────────────────────────────────────────────────────────────
    if (action === 'trending') {
      const type = media_type === 'all' ? 'all' : media_type === 'tv' ? 'tv' : 'movie';
      const data = await tmdb(`/trending/${type}/week`, { language, page });
      return Response.json({ results: data.results.map(mapMovie), total_pages: data.total_pages });
    }

    // ── popular ───────────────────────────────────────────────────────────────
    if (action === 'popular') {
      const type = media_type === 'tv' ? 'tv' : 'movie';
      const data = await tmdb(`/${type}/popular`, { language, page });
      return Response.json({ results: data.results.map(mapMovie), total_pages: data.total_pages });
    }

    // ── upcoming ──────────────────────────────────────────────────────────────
    if (action === 'upcoming') {
      const data = await tmdb('/movie/upcoming', { language, page });
      return Response.json({ results: data.results.map(mapMovie), total_pages: data.total_pages });
    }

    // ── top rated ─────────────────────────────────────────────────────────────
    if (action === 'top_rated') {
      const type = media_type === 'tv' ? 'tv' : 'movie';
      const data = await tmdb(`/${type}/top_rated`, { language, page });
      return Response.json({ results: data.results.map(mapMovie), total_pages: data.total_pages });
    }

    // ── search ────────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query) return Response.json({ error: 'query required' }, { status: 400 });
      const data = await tmdb('/search/multi', { query, language, page, include_adult: false });
      return Response.json({ results: data.results.map(mapMovie), total_pages: data.total_pages });
    }

    // ── details ───────────────────────────────────────────────────────────────
    if (action === 'details') {
      if (!tmdb_id) return Response.json({ error: 'tmdb_id required' }, { status: 400 });
      const type = media_type === 'tv' ? 'tv' : 'movie';
      const [details, credits, images, videos, similar] = await Promise.all([
        tmdb(`/${type}/${tmdb_id}`, { language }),
        tmdb(`/${type}/${tmdb_id}/credits`, { language }),
        tmdb(`/${type}/${tmdb_id}/images`, { include_image_language: 'en,null' }),
        tmdb(`/${type}/${tmdb_id}/videos`, { language }),
        tmdb(`/${type}/${tmdb_id}/similar`, { language }),
      ]);

      const cast = credits.cast?.slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        photo: img(c.profile_path, 'w185'),
      }));

      const trailers = videos.results?.filter(v => v.type === 'Trailer' && v.site === 'YouTube')
        .map(v => ({ key: v.key, name: v.name, url: `https://www.youtube.com/watch?v=${v.key}` }));

      const posters = images.posters?.slice(0, 10).map(p => ({
        path: img(p.file_path, 'w500'),
        original: img(p.file_path, 'original'),
        thumb: img(p.file_path, 'w185'),
        language: p.iso_639_1,
        rating: p.vote_average,
      }));

      const backdrops = images.backdrops?.slice(0, 6).map(b => ({
        path: img(b.file_path, 'w1280'),
        original: img(b.file_path, 'original'),
        thumb: img(b.file_path, 'w780'),
        rating: b.vote_average,
      }));

      const logos = images.logos?.slice(0, 3).map(l => ({
        path: img(l.file_path, 'w300'),
        original: img(l.file_path, 'original'),
        language: l.iso_639_1,
      }));

      return Response.json({
        ...mapDetails(details, type),
        cast,
        trailers,
        posters,
        backdrops,
        logos,
        similar: similar.results?.slice(0, 10).map(mapMovie),
      });
    }

    // ── recommendations ───────────────────────────────────────────────────────
    if (action === 'recommendations') {
      if (!tmdb_id) return Response.json({ error: 'tmdb_id required' }, { status: 400 });
      const type = media_type === 'tv' ? 'tv' : 'movie';
      const data = await tmdb(`/${type}/${tmdb_id}/recommendations`, { language, page });
      return Response.json({ results: data.results.map(mapMovie) });
    }

    // ── season details ────────────────────────────────────────────────────────
    if (action === 'season') {
      if (!tmdb_id) return Response.json({ error: 'tmdb_id required' }, { status: 400 });
      const season = await req.json().then ? undefined : (await req.json()).season_number;
      const data = await tmdb(`/tv/${tmdb_id}/season/${season || 1}`, { language });
      return Response.json({
        season_number: data.season_number,
        name: data.name,
        poster: img(data.poster_path, 'w342'),
        episodes: data.episodes?.map(e => ({
          number: e.episode_number,
          name: e.name,
          overview: e.overview,
          still: img(e.still_path, 'w300'),
          air_date: e.air_date,
          runtime: e.runtime,
          rating: e.vote_average,
        })),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});