import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { resolveEmbyUserId as resolveCachedUserId } from '../../shared/embyAuth.ts';

async function getEmbyServer(base44, serverId) {
  const servers = await base44.entities.MediaServer.list();
  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);
  if (serverId) return embyServers.find(s => s.id === serverId) || null;
  return embyServers[0] || null;
}

async function doFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
    if (token) headers['X-Emby-Token'] = token;
    const res = await fetch(url, {
      headers,
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
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&MaxWidth=400`;
}

const EMBY_AUTH_HEADER =
  'MediaBrowser Client="StreamVault", Device="Server", DeviceId="streamvault-backend", Version="1.0.0"';

async function authenticateByName(base, username, password) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': EMBY_AUTH_HEADER,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Auth HTTP ${res.status}`);
    const data = await res.json();
    return { token: data?.AccessToken || null, userId: data?.User?.Id || null };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUserId(base, token) {
  try {
    const users = await doFetch(`${base}/Users?api_key=${token}`, token);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`, token);
    if (me?.Id) return me.Id;
  } catch (_) {}
  throw new Error('Could not authenticate with Emby.');
}

async function resolveAuth(base, server, base44) {
  const storedToken = server.api_token;
  if (storedToken) {
    try {
      // Reuse the cached userId on the server record — avoids the expensive
      // /Users enumeration on every home-page load.
      const userId = await resolveCachedUserId(base44, server, base, storedToken);
      return { token: storedToken, userId };
    } catch (_) { /* fall through to username/password */ }
  }
  if (server.username && server.password) {
    const { token, userId } = await authenticateByName(base, server.username, server.password);
    if (token) {
      return { token, userId: userId || (await resolveUserId(base, token)) };
    }
  }
  throw new Error('Could not authenticate with Emby.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const server = await getEmbyServer(base44, body?.serverId);
    if (!server) return Response.json({ items: [] });

    const base = server.server_url.replace(/\/$/, '');
    const { token, userId } = await resolveAuth(base, server, base44);

    // Fetch resume items (in-progress) from Emby
    const json = await doFetch(
      `${base}/Users/${userId}/Items/Resume?MediaTypes=Video&Limit=20` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,UserData,ImageTags,BackdropImageTags` +
      `&api_key=${token}`,
      token
    );

    const rawItems = json?.Items || [];

    const items = rawItems.map(item => ({
      id: item.Id,
      title: item.Name,
      type: item.Type,
      year: item.ProductionYear || null,
      rating: item.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : null,
      duration: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
      overview: item.Overview || '',
      genres: item.Genres || [],
      posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
      backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
      // Playback progress
      progressTicks: item.UserData?.PlaybackPositionTicks || 0,
      totalTicks: item.RunTimeTicks || 0,
      progressPercent: item.RunTimeTicks > 0
        ? Math.round((item.UserData?.PlaybackPositionTicks || 0) / item.RunTimeTicks * 100)
        : 0,
      seriesName: item.SeriesName || null,
      episodeName: item.Type === 'Episode' ? item.Name : null,
      seasonEpisode: item.ParentIndexNumber && item.IndexNumber
        ? `S${item.ParentIndexNumber}E${item.IndexNumber}`
        : null,
    }));

    return Response.json({
      items,
      server: { id: server.id, server_name: server.server_name },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});