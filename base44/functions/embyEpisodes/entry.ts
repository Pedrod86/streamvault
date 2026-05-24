import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

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
      `&Fields=Overview,ImageTags,RunTimeTicks&Limit=500`
    );
    const episodes = (episodesData?.Items || []).map(e => ({
      id: e.Id,
      name: e.Name,
      seasonIndex: e.ParentIndexNumber || 0,
      episodeIndex: e.IndexNumber || 0,
      overview: e.Overview || '',
      durationMinutes: e.RunTimeTicks ? Math.round(e.RunTimeTicks / 600000000) : null,
      thumbUrl: e.ImageTags?.Primary
        ? `${base}/Items/${e.Id}/Images/Primary?api_key=${token}&MaxWidth=400`
        : null,
      streamUrl: `${base}/Videos/${e.Id}/stream?api_key=${token}&Static=true`,
    }));

    return Response.json({ seasons, episodes, server: { server_url: base, api_token: token } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});