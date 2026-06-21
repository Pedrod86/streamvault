import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUserId(base, token) {
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`);
    if (me?.Id) return me.Id;
  } catch (_) {}
  const users = await doFetch(`${base}/Users?api_key=${token}`);
  const list = Array.isArray(users) ? users : (users?.Items || []);
  const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
  if (admin?.Id) return admin.Id;
  throw new Error('Could not authenticate with Emby.');
}

// Returns just the TotalRecordCount for a filtered query (Limit=0 = no payload)
async function countOf(base, userId, token, params) {
  const url =
    `${base}/Users/${userId}/Items?Recursive=true&Limit=0&api_key=${token}&${params}`;
  const json = await doFetch(url);
  return json?.TotalRecordCount || 0;
}

// Counts distinct 4K series by deduplicating the parent series of every 4K episode.
async function count4kSeries(base, userId, token) {
  const distinct = new Set();
  let start = 0;
  const page = 1000;
  let total = Infinity;
  while (start < total && start < 50000) {
    const url =
      `${base}/Users/${userId}/Items?Recursive=true&Limit=${page}&StartIndex=${start}` +
      `&api_key=${token}&IncludeItemTypes=Episode&Is4K=true&Fields=SeriesId`;
    const j = await doFetch(url);
    total = j?.TotalRecordCount || 0;
    (j?.Items || []).forEach(i => { if (i.SeriesId) distinct.add(i.SeriesId); });
    start += page;
  }
  return distinct.size;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    const [movies, shows, kids, anime, sports] = await Promise.all([
      countOf(base, userId, token, 'IncludeItemTypes=Movie'),
      countOf(base, userId, token, 'IncludeItemTypes=Series'),
      countOf(base, userId, token, 'IncludeItemTypes=Movie,Series&Genres=' + encodeURIComponent('Kids|Children|Family')),
      countOf(base, userId, token, 'IncludeItemTypes=Movie,Series&Genres=' + encodeURIComponent('Anime|Animation')),
      countOf(base, userId, token, 'IncludeItemTypes=Movie,Series&Genres=Sport'),
    ]);

    // 4K movies — count by actual resolution via Emby's Is4K filter.
    const fourkMovies = await countOf(base, userId, token, 'IncludeItemTypes=Movie&Is4K=true');

    // 4K series — the series container never carries Is4K, only episodes do.
    // Count distinct parent series across all 4K episodes.
    const fourkShows = await count4kSeries(base, userId, token);

    return Response.json({
      movies, shows, kids, anime, sports,
      fourkMovies, fourkShows,
      server: { id: server.id, server_name: server.server_name },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});