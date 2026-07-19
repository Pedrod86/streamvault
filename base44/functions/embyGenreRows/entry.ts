import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveEmbyUserId as resolveCachedUserId } from '../../shared/embyAuth.ts';

async function getEmbyServer(base44, serverId) {
  const servers = await base44.entities.MediaServer.list();
  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);
  if (serverId) return embyServers.find(s => s.id === serverId) || null;
  return embyServers[0] || null;
}

async function doFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
    if (token) headers['X-Emby-Token'] = token;
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
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
      headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': EMBY_AUTH_HEADER },
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
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`, token);
    if (me?.Id) return me.Id;
  } catch (_) {}
  const users = await doFetch(`${base}/Users?api_key=${token}`, token);
  const list = Array.isArray(users) ? users : (users?.Items || []);
  const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
  if (admin?.Id) return admin.Id;
  throw new Error('Could not authenticate with Emby.');
}

async function resolveAuth(base, server, base44) {
  const storedToken = server.api_token;
  if (storedToken) {
    try {
      const userId = await resolveCachedUserId(base44, server, base, storedToken);
      return { token: storedToken, userId };
    } catch (_) {}
  }
  if (server.username && server.password) {
    const { token, userId } = await authenticateByName(base, server.username, server.password);
    if (token) return { token, userId: userId || (await resolveUserId(base, token)) };
  }
  throw new Error('Could not authenticate with Emby.');
}

const FIELDS = 'Overview,Genres,OfficialRating,CommunityRating,ProductionYear,ImageTags,MediaStreams,Height,Width,Tags';

// Curated set of common genres to surface as rows, in display order.
const GENRES = ['Action', 'Comedy', 'Sci-Fi', 'Drama', 'Horror', 'Thriller', 'Animation', 'Romance', 'Documentary'];

// Emby stores some of these under alternate names — map to the tags we query with.
const GENRE_ALIASES = {
  'Sci-Fi': ['Sci-Fi', 'Science Fiction'],
};

function mapItem(base, token, item) {
  const videoStream = (item.MediaStreams || []).find(s => s.Type === 'Video');
  const maxHeight = Math.max(item.Height || 0, videoStream?.Height || 0);
  const embyTags = (item.Tags || []).map(t => String(t).toLowerCase());
  const is4k = maxHeight >= 2160 ||
    /\b(4K|UHD|2160p)\b/i.test(item.Name || '') ||
    (item.MediaStreams || []).some(s => s.Type === 'Video' && (s.Width >= 3840 || s.Height >= 2160)) ||
    embyTags.some(t => /4k|uhd|2160p/.test(t));

  return {
    id: item.Id,
    title: item.Name,
    type: item.Type,
    year: item.ProductionYear || null,
    rating: item.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : null,
    overview: item.Overview || '',
    genres: item.Genres || [],
    posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
    is4k,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const server = await getEmbyServer(base44, body?.serverId);
    if (!server) return Response.json({ rows: [] });

    const base = server.server_url.replace(/\/$/, '');
    const { token, userId } = await resolveAuth(base, server, base44);

    const LIMIT = 20;

    const rows = await Promise.all(GENRES.map(async (genre) => {
      const genreQuery = (GENRE_ALIASES[genre] || [genre]).map(encodeURIComponent).join('|');
      const url =
        `${base}/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series` +
        `&Genres=${genreQuery}&Fields=${FIELDS}` +
        `&SortBy=CommunityRating,DateCreated&SortOrder=Descending&Limit=${LIMIT}&api_key=${token}`;
      let items = [];
      try {
        const raw = await doFetch(url, token);
        items = (raw?.Items || []).map(i => mapItem(base, token, i));
      } catch (_) {}
      return { genre, items };
    }));

    return Response.json({
      rows: rows.filter(r => r.items.length > 0),
      server: { id: server.id, server_name: server.server_name, server_url: base, api_token: token },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});