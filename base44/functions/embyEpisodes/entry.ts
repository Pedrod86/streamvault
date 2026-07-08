import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Module-level server cache — avoids hitting DB on every request
let _serverCache = null;
let _serverCacheAt = 0;
const SERVER_CACHE_TTL = 5 * 60 * 1000;

async function getEmbyServer(base44client) {
  const now = Date.now();
  if (_serverCache && (now - _serverCacheAt) < SERVER_CACHE_TTL) return _serverCache;
  const servers = await base44client.entities.MediaServer.list();
  const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false) || null;
  _serverCache = server;
  _serverCacheAt = now;
  return server;
}

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
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

async function resolveUserId(base, token) {
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`);
    if (me?.Id) return me.Id;
  } catch (_) {}
  try {
    const users = await doFetch(`${base}/Users?api_key=${token}`);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}
  throw new Error('Could not authenticate with Emby.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const seriesId = body.seriesId;
    if (!seriesId) return Response.json({ error: 'Missing seriesId' }, { status: 400 });

    const server = await getEmbyServer(base44);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    // Latest-episode mode — returns the most recently added episode for direct play
    if (body.latest) {
      const latestData = await doFetch(
        `${base}/Shows/${seriesId}/Episodes?UserId=${userId}&api_key=${token}` +
        `&Fields=DateCreated,RunTimeTicks&SortBy=DateCreated&SortOrder=Descending&Limit=1`
      );
      const ep = (latestData?.Items || [])[0];
      if (!ep) return Response.json({ error: 'No episodes found' }, { status: 404 });
      return Response.json({
        episode: {
          id: ep.Id,
          name: ep.Name,
          seasonIndex: ep.ParentIndexNumber || 0,
          episodeIndex: ep.IndexNumber || 0,
          streamUrl: `${base}/Videos/${ep.Id}/stream?api_key=${token}&Static=true`,
        },
        server: { server_url: base, api_token: token },
      });
    }

    // Fetch all seasons
    const seasonsData = await doFetch(
      `${base}/Shows/${seriesId}/Seasons?UserId=${userId}&api_key=${token}&Fields=Overview,ImageTags`
    );
    const seasons = (seasonsData?.Items || []).map(s => ({
      id: s.Id,
      name: s.Name,
      index: s.IndexNumber || 0,
      posterUrl: s.ImageTags?.Primary
        ? `${base}/Items/${s.Id}/Images/Primary?api_key=${token}&MaxWidth=300`
        : null,
    }));

    // Fetch all episodes
    const episodesData = await doFetch(
      `${base}/Shows/${seriesId}/Episodes?UserId=${userId}&api_key=${token}` +
      `&Fields=Overview,ImageTags,RunTimeTicks,MediaStreams&Limit=500`
    );
    const episodes = (episodesData?.Items || []).map(e => {
      const vStream = (e.MediaStreams || []).find(s => s.Type === 'Video');
      const h = vStream?.Height || 0;
      const quality = h >= 2160 ? '4K' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : h >= 480 ? '480p' : null;
      const codec = vStream?.Codec ? String(vStream.Codec).toUpperCase() : null;
      return {
        id: e.Id,
        name: e.Name,
        seasonIndex: e.ParentIndexNumber || 0,
        episodeIndex: e.IndexNumber || 0,
        overview: e.Overview || '',
        durationMinutes: e.RunTimeTicks ? Math.round(e.RunTimeTicks / 600000000) : null,
        quality,
        codec,
        thumbUrl: e.ImageTags?.Primary
          ? `${base}/Items/${e.Id}/Images/Primary?api_key=${token}&MaxWidth=400`
          : null,
        streamUrl: `${base}/Videos/${e.Id}/stream?api_key=${token}&Static=true`,
      };
    });

    return Response.json({ seasons, episodes, server: { server_url: base, api_token: token } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});