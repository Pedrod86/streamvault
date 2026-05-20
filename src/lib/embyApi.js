/**
 * Emby API helpers — all requests go through the mediaProxy backend
 * to avoid CORS issues when the server is on a remote/CDN URL.
 */
import { base44 } from '@/api/base44Client';

export async function embyProxyFetch(url, headers = {}) {
  const res = await base44.functions.invoke('mediaProxy', { url, headers });
  if (res.data?.error) throw new Error(res.data.error);
  if (!res.data?.ok) throw new Error(`Server responded with HTTP ${res.data?.status}`);
  return res.data.data;
}

export function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&maxWidth=400`;
}

export function buildStreamUrl(base, itemId, token) {
  return `${base}/Videos/${itemId}/stream?api_key=${token}&Static=true`;
}

export async function resolveEmbyUserId(base, token) {
  const headers = { 'X-Emby-Token': token };
  let userId;
  try {
    const me = await embyProxyFetch(`${base}/Users/Me`, headers);
    userId = me?.Id;
  } catch (_) {}
  if (!userId) {
    const users = await embyProxyFetch(`${base}/Users`, headers);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    userId = admin?.Id;
  }
  if (!userId) throw new Error('Could not authenticate with Emby');
  return userId;
}

export async function fetchEmbyRecentlyAdded(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const headers = { 'X-Emby-Token': token };

  const userId = await resolveEmbyUserId(base, token);

  const items = await embyProxyFetch(
    `${base}/Users/${userId}/Items/Latest?IncludeItemTypes=Movie,Episode` +
    `&Fields=Overview,Genres,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,SeriesName,ParentId&Limit=20`,
    headers
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
  const headers = { 'X-Emby-Token': token };

  const userId = await resolveEmbyUserId(base, token);

  const PAGE = 500;
  let startIndex = 0;
  const all = [];

  while (true) {
    const json = await embyProxyFetch(
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
      `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}`,
      headers
    );
    const items = json.Items || [];
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