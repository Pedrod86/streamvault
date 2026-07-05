import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns the seasons + episodes for a Plex series, each episode carrying its
 * own direct-play stream URL. Shape mirrors embyEpisodes so the UI can be shared.
 * Usage: POST { seriesId: "12345" }
 * Returns: { seasons: [{id, index, name}], episodes: [{id, name, seasonIndex, episodeIndex, durationMinutes, overview, thumbUrl, streamUrl}] }
 */

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildThumb(base, thumb, token) {
  if (!thumb) return null;
  const path = encodeURIComponent(thumb);
  return `${base}/photo/:/transcode?width=320&height=180&minSize=1&url=${path}&X-Plex-Token=${token}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { seriesId } = await req.json();
    if (!seriesId) return Response.json({ error: 'Missing seriesId' }, { status: 400 });

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'plex' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No Plex server connected' }, { status: 404 });

    const base = (server.server_url || '').replace(/\/web\/?$/, '').replace(/\/$/, '');
    const token = server.plex_token || server.api_token;
    if (!base || !token) return Response.json({ error: 'Plex server misconfigured' }, { status: 400 });

    // Fetch seasons for the show
    const seasonsRaw = await doFetch(`${base}/library/metadata/${seriesId}/children?X-Plex-Token=${token}`);
    const seasonDirs = (seasonsRaw?.MediaContainer?.Metadata || []).filter(s => (s.type || '') === 'season');

    const seasons = [];
    const episodes = [];

    for (const season of seasonDirs) {
      const seasonIndex = season.index ?? 0;
      seasons.push({ id: season.ratingKey, index: seasonIndex, name: season.title || `Season ${seasonIndex}` });

      const epsRaw = await doFetch(`${base}/library/metadata/${season.ratingKey}/children?X-Plex-Token=${token}`);
      const eps = (epsRaw?.MediaContainer?.Metadata || []).filter(e => (e.type || '') === 'episode');

      for (const ep of eps) {
        const part = ep.Media?.[0]?.Part?.[0];
        episodes.push({
          id: ep.ratingKey,
          name: ep.title || `Episode ${ep.index ?? ''}`,
          seasonIndex,
          episodeIndex: ep.index ?? 0,
          durationMinutes: ep.duration ? Math.round(ep.duration / 60000) : null,
          overview: ep.summary || '',
          thumbUrl: buildThumb(base, ep.thumb, token),
          streamUrl: part?.key ? `${base}${part.key}?X-Plex-Token=${token}` : null,
        });
      }
    }

    return Response.json({ seasons, episodes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});