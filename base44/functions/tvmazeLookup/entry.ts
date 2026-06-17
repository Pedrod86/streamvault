import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = 'https://api.tvmaze.com';

async function tvmaze(path) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`TVmaze ${r.status}`);
  }
  return r.json();
}

function mapShow(s) {
  if (!s) return null;
  return {
    tvmaze_id: s.id,
    title: s.name,
    type: s.type,
    language: s.language,
    genres: s.genres,
    status: s.status,
    runtime: s.runtime,
    premiered: s.premiered,
    ended: s.ended,
    network: s.network?.name,
    country: s.network?.country?.name,
    webChannel: s.webChannel?.name,
    rating: s.rating?.average,
    image_medium: s.image?.medium,
    image_original: s.image?.original,
    overview: s.summary?.replace(/<[^>]+>/g, ''),
    url: s.url,
    externals: s.externals, // { imdb, tvdb, thetvdb }
  };
}

function mapEpisode(e) {
  return {
    id: e.id,
    name: e.name,
    season: e.season,
    number: e.number,
    type: e.type,
    airdate: e.airdate,
    runtime: e.runtime,
    rating: e.rating?.average,
    image: e.image?.medium,
    overview: e.summary?.replace(/<[^>]+>/g, ''),
    url: e.url,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, query, tvmaze_id, imdb_id, tvdb_id, season } = await req.json();

    // ── search ────────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!query) return Response.json({ error: 'query required' }, { status: 400 });
      const data = await tvmaze(`/search/shows?q=${encodeURIComponent(query)}`);
      return Response.json({ results: (data || []).map(r => mapShow(r.show)) });
    }

    // ── show by ID ────────────────────────────────────────────────────────────
    if (action === 'show') {
      const id = tvmaze_id;
      if (!id) return Response.json({ error: 'tvmaze_id required' }, { status: 400 });
      const [show, cast, episodes] = await Promise.all([
        tvmaze(`/shows/${id}?embed[]=nextepisode&embed[]=previousepisode`),
        tvmaze(`/shows/${id}/cast`),
        tvmaze(`/shows/${id}/episodes`),
      ]);
      if (!show) return Response.json({ found: false });
      return Response.json({
        ...mapShow(show),
        found: true,
        cast: (cast || []).slice(0, 15).map(c => ({
          name: c.person?.name,
          character: c.character?.name,
          image: c.person?.image?.medium,
          url: c.person?.url,
        })),
        episodes: (episodes || []).map(mapEpisode),
        next_episode: show._embedded?.nextepisode ? mapEpisode(show._embedded.nextepisode) : null,
        prev_episode: show._embedded?.previousepisode ? mapEpisode(show._embedded.previousepisode) : null,
      });
    }

    // ── lookup by external ID ─────────────────────────────────────────────────
    if (action === 'lookup') {
      let data = null;
      if (imdb_id) data = await tvmaze(`/lookup/shows?imdb=${imdb_id}`);
      else if (tvdb_id) data = await tvmaze(`/lookup/shows?thetvdb=${tvdb_id}`);
      else return Response.json({ error: 'imdb_id or tvdb_id required' }, { status: 400 });
      return Response.json(data ? { found: true, ...mapShow(data) } : { found: false });
    }

    // ── season episodes ───────────────────────────────────────────────────────
    if (action === 'season_episodes') {
      if (!tvmaze_id || season == null) return Response.json({ error: 'tvmaze_id and season required' }, { status: 400 });
      const data = await tvmaze(`/shows/${tvmaze_id}/episodes?season=${season}`);
      return Response.json({ episodes: (data || []).map(mapEpisode) });
    }

    // ── schedule (upcoming) ───────────────────────────────────────────────────
    if (action === 'schedule') {
      const today = new Date().toISOString().split('T')[0];
      const data = await tvmaze(`/schedule?date=${today}&country=US`);
      return Response.json({
        episodes: (data || []).slice(0, 30).map(e => ({
          ...mapEpisode(e),
          show_title: e.show?.name,
          show_image: e.show?.image?.medium,
        })),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});