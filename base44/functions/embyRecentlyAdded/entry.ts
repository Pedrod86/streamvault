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

function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&maxWidth=400`;
}

async function resolveUserId(base, token) {
  try {
    const users = await doFetch(`${base}/Users?api_key=${token}`);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`);
    if (me?.Id) return me.Id;
  } catch (_) {}
  throw new Error('Could not authenticate with Emby.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
    if (!server) return Response.json({ items: [] });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    const json = await doFetch(
      `${base}/Users/${userId}/Items/Latest` +
      `?IncludeItemTypes=Movie,Episode` +
      `&Fields=Overview,Genres,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,SeriesName,ParentIndexNumber,IndexNumber` +
      `&Limit=20&api_key=${token}`
    );

    const rawItems = Array.isArray(json) ? json : (json?.Items || []);

    const items = rawItems.map(item => ({
      id: item.Id,
      title: item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name,
      subtitle: item.Type === 'Episode' && item.ParentIndexNumber && item.IndexNumber
        ? `S${String(item.ParentIndexNumber).padStart(2, '0')}E${String(item.IndexNumber).padStart(2, '0')} – ${item.Name}`
        : null,
      type: item.Type,
      year: item.ProductionYear || null,
      rating: item.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : null,
      overview: item.Overview || '',
      genres: item.Genres || [],
      posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
      backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
    }));

    return Response.json({
      items,
      server: { id: server.id, server_name: server.server_name, server_url: base, api_token: token },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});