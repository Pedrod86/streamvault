/**
 * Emby API helpers — all requests go through the mediaProxy backend
 * to avoid CORS issues when the server is on a remote/CDN URL.
 */
import { base44 } from '@/api/base44Client';

export async function embyProxyFetch(url, headers = {}) {
  const res = await base44.functions.invoke('mediaProxy', { url, headers });
  if (res.data?.error) throw new Error(`Proxy error: ${res.data.error}`);
  if (!res.data?.ok) {
    const status = res.data?.status;
    const body = typeof res.data?.data === 'string' ? res.data.data.slice(0, 200) : JSON.stringify(res.data?.data);
    if (status === 502 || status === 503 || status === 504 || status === 0) {
      throw new Error(
        `Cannot reach your Emby server (HTTP ${status || 'timeout'}). ` +
        `Make sure the server URL is publicly accessible — local IPs (192.168.x.x, localhost) ` +
        `cannot be reached by the proxy.`
      );
    }
    throw new Error(`Emby returned HTTP ${status}: ${body}`);
  }
  return res.data.data;
}

export function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&MaxWidth=400`;
}

export function buildStreamUrl(base, itemId, token) {
  return `${base}/Videos/${itemId}/stream?api_key=${token}&Static=true`;
}

/**
 * Resolve the Emby user ID. Tries header auth first, then api_key query param.
 * Returns the user ID string.
 */
export async function resolveEmbyUserId(base, token) {
  // Try /Users with api_key query param — works on most Emby servers
  try {
    const users = await embyProxyFetch(`${base}/Users?api_key=${token}`, {});
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}

  // Fallback: /Users/Me with header auth
  try {
    const me = await embyProxyFetch(`${base}/Users/Me`, { 'X-Emby-Token': token });
    if (me?.Id) return me.Id;
  } catch (_) {}

  throw new Error('Could not authenticate with Emby — check your server URL and API token');
}

export async function fetchEmbyRecentlyAdded(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;

  const userId = await resolveEmbyUserId(base, token);

  const items = await embyProxyFetch(
    `${base}/Users/${userId}/Items/Latest?IncludeItemTypes=Movie,Episode` +
    `&Fields=Overview,Genres,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,SeriesName,ParentId&Limit=20&api_key=${token}`,
    {}
  );

  return (Array.isArray(items) ? items : []).map(item => ({
    id: item.Id,
    title: item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name,
    subtitle: item.Type === 'Episode'
      ? `S${String(item.ParentIndexNumber).padStart(2, '0')}E${String(item.IndexNumber).padStart(2, '0')} – ${item.Name}`
      : null,
    type: item.Type,
    year: item.ProductionYear,
    rating: item.CommunityRating ? parseFloat(item.CommunityRating.toFixed(1)) : null,
    overview: item.Overview || '',
    genres: item.Genres || [],
    posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
    backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
    streamUrl: buildStreamUrl(base, item.Id, token),
  }));
}

export async function fetchEmbyFullLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;

  const userId = await resolveEmbyUserId(base, token);

  const PAGE = 500;
  let startIndex = 0;
  const all = [];

  while (true) {
    const json = await embyProxyFetch(
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
      `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}&api_key=${token}`,
      {}
    );
    const items = json?.Items || [];
    for (const item of items) {
      all.push({
        id: item.Id,
        title: item.Name,
        type: item.Type,
        year: item.ProductionYear,
        rating: item.CommunityRating ? parseFloat(item.CommunityRating.toFixed(1)) : null,
        duration: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
        overview: item.Overview || '',
        genres: item.Genres || [],
        posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
        backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
        streamUrl: buildStreamUrl(base, item.Id, token),
      });
    }
    if (items.length < PAGE) break;
    startIndex += PAGE;
  }

  return all;
}