/**
 * Emby API helpers — LAN-first with relay fallback.
 *
 * Requests try the local network URL directly from the client first (fast, no
 * proxy), and fall back to the remote relay URL through the mediaProxy backend
 * when the LAN isn't reachable. See lib/embyConnection.js for the strategy.
 */
import { resolveEmbyConnection } from '@/lib/embyConnection';

export function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&MaxWidth=400`;
}

export function buildStreamUrl(base, itemId, token) {
  return `${base}/Videos/${itemId}/stream?api_key=${token}&Static=true`;
}

/**
 * Resolve the Emby user ID using the active connection (LAN or relay).
 */
export async function resolveEmbyUserId(conn) {
  const { token } = conn;
  try {
    const users = await conn.fetchJson(`/Users?api_key=${token}`);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}

  try {
    const me = await conn.fetchJson('/Users/Me', { 'X-Emby-Token': token });
    if (me?.Id) return me.Id;
  } catch (_) {}

  throw new Error('Could not authenticate with Emby — check your server URL and API token');
}

export async function fetchEmbyRecentlyAdded(server) {
  const conn = await resolveEmbyConnection(server);
  const { base, token } = conn;
  const userId = await resolveEmbyUserId(conn);

  const items = await conn.fetchJson(
    `/Users/${userId}/Items/Latest?IncludeItemTypes=Movie,Episode` +
    `&Fields=Overview,Genres,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,SeriesName,ParentId&Limit=20&api_key=${token}`
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
  const conn = await resolveEmbyConnection(server);
  const { base, token } = conn;
  const userId = await resolveEmbyUserId(conn);

  const PAGE = 500;
  let startIndex = 0;
  const all = [];

  while (true) {
    const json = await conn.fetchJson(
      `/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
      `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}&api_key=${token}`
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