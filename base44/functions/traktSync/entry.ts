import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TRAKT_BASE = 'https://api.trakt.tv';

async function traktFetch(path, token, clientId) {
  const r = await fetch(`${TRAKT_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'Authorization': `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    if (r.status === 401) throw new Error('Trakt token expired or invalid. Please reconnect.');
    if (r.status === 404) return null;
    throw new Error(`Trakt API ${r.status}`);
  }
  return r.json();
}

function mapTraktMovie(item) {
  const m = item.movie || item;
  return {
    title: m.title,
    year: m.year,
    ids: m.ids,
    watched_at: item.watched_at,
    rating: item.rating,
    listed_at: item.listed_at,
  };
}

function mapTraktShow(item) {
  const s = item.show || item;
  return {
    title: s.title,
    year: s.year,
    ids: s.ids,
    watched_at: item.watched_at,
    rating: item.rating,
    listed_at: item.listed_at,
    seasons: item.seasons,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // Fetch Trakt connection from MediaServer entity
    const servers = await base44.entities.MediaServer.filter({ server_type: 'trakt' });
    if (!servers.length) return Response.json({ error: 'No Trakt account connected' }, { status: 404 });

    const trakt = servers[0];
    const token = trakt.api_token;
    const clientId = trakt.client_id;

    if (!token) return Response.json({ error: 'No Trakt access token. Use OAuth pin method to connect.' }, { status: 400 });
    if (!clientId) return Response.json({ error: 'No Trakt client ID. Please reconnect your Trakt account.' }, { status: 400 });

    // ── trending ──────────────────────────────────────────────────────────────
    if (action === 'trending_movies') {
      const data = await traktFetch('/movies/trending?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(i => ({ ...mapTraktMovie(i), watchers: i.watchers })) });
    }

    if (action === 'trending_shows') {
      const data = await traktFetch('/shows/trending?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(i => ({ ...mapTraktShow(i), watchers: i.watchers })) });
    }

    // ── popular ───────────────────────────────────────────────────────────────
    if (action === 'popular_movies') {
      const data = await traktFetch('/movies/popular?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(m => ({ title: m.title, year: m.year, ids: m.ids })) });
    }

    if (action === 'popular_shows') {
      const data = await traktFetch('/shows/popular?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(s => ({ title: s.title, year: s.year, ids: s.ids })) });
    }

    // ── recommendations ───────────────────────────────────────────────────────
    if (action === 'recommendations_movies') {
      const data = await traktFetch('/recommendations/movies?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(m => ({ title: m.title, year: m.year, ids: m.ids })) });
    }

    if (action === 'recommendations_shows') {
      const data = await traktFetch('/recommendations/shows?limit=20&extended=full', token, clientId);
      return Response.json({ results: (data || []).map(s => ({ title: s.title, year: s.year, ids: s.ids })) });
    }

    // ── watch history sync ────────────────────────────────────────────────────
    if (action === 'sync_history') {
      const [movies, shows, ratings, watchlist] = await Promise.all([
        traktFetch('/sync/history/movies?limit=100&extended=full', token, clientId),
        traktFetch('/sync/history/shows?limit=100&extended=full', token, clientId),
        traktFetch('/sync/ratings?extended=full', token, clientId),
        traktFetch('/sync/watchlist?extended=full', token, clientId),
      ]);

      return Response.json({
        history_movies: (movies || []).map(mapTraktMovie),
        history_shows: (shows || []).map(mapTraktShow),
        ratings: (ratings || []).map(r => ({
          type: r.type,
          rating: r.rating,
          rated_at: r.rated_at,
          title: (r.movie || r.show)?.title,
          ids: (r.movie || r.show)?.ids,
        })),
        watchlist: (watchlist || []).map(w => ({
          type: w.type,
          listed_at: w.listed_at,
          title: (w.movie || w.show)?.title,
          year: (w.movie || w.show)?.year,
          ids: (w.movie || w.show)?.ids,
        })),
      });
    }

    // ── collection ────────────────────────────────────────────────────────────
    if (action === 'collection') {
      const [movies, shows] = await Promise.all([
        traktFetch('/sync/collection/movies?extended=full', token, clientId),
        traktFetch('/sync/collection/shows?extended=full', token, clientId),
      ]);
      return Response.json({
        movies: (movies || []).map(mapTraktMovie),
        shows: (shows || []).map(mapTraktShow),
      });
    }

    // ── progress (continue watching) ──────────────────────────────────────────
    if (action === 'progress') {
      const data = await traktFetch('/sync/playback?extended=full&limit=50', token, clientId);
      return Response.json({
        items: (data || []).map(i => ({
          type: i.type,
          progress: i.progress,
          title: (i.movie || i.show)?.title,
          year: (i.movie || i.show)?.year,
          ids: (i.movie || i.show)?.ids,
          episode: i.episode ? { season: i.episode.season, number: i.episode.number, title: i.episode.title } : null,
        })),
      });
    }

    // ── user stats ────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const data = await traktFetch('/users/me/stats', token, clientId);
      return Response.json(data || {});
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});