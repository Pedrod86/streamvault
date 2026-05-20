import { base44 } from '@/api/base44Client';
import { mapEmbyItem } from '@/lib/embyMapper';

/**
 * All fetches go through the server-side mediaProxy backend function
 * to avoid CORS issues with HTTP media servers.
 */
async function proxyFetch(url, headers = {}) {
  let res;
  try {
    res = await base44.functions.invoke('mediaProxy', { url, headers });
  } catch (err) {
    throw new Error(`Proxy error: ${err.message}`);
  }

  // Proxy itself returned an error (e.g. timeout, network failure)
  if (res.data?.error) {
    const msg = res.data.error;
    // Detect private/local IP unreachable errors and give a clear explanation
    if (
      msg.includes('Connection refused') ||
      msg.includes('tcp connect error') ||
      msg.includes('client error (Connect)')
    ) {
      throw new Error(
        'Cannot reach server — the backend proxy runs in the cloud and cannot connect to local/private network addresses (e.g. 192.168.x.x, 10.x.x.x). ' +
        'Your server must be accessible on the public internet (via a public IP or domain + port forwarding) for sync to work.'
      );
    }
    throw new Error(msg);
  }

  // Upstream returned a non-OK HTTP status
  if (!res.data.ok) {
    throw new Error(`Server responded with HTTP ${res.data.status}`);
  }

  return res.data.data;
}

// ─── PLEX ────────────────────────────────────────────────────────────────────

async function fetchPlexLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.plex_token || server.api_token;

  const sectionsJson = await proxyFetch(`${base}/library/sections?X-Plex-Token=${token}`);
  const sections = sectionsJson?.MediaContainer?.Directory || [];

  const items = [];
  for (const section of sections) {
    if (!['movie', 'show'].includes(section.type)) continue;
    const json = await proxyFetch(`${base}/library/sections/${section.key}/all?X-Plex-Token=${token}`);
    const list = json?.MediaContainer?.Metadata || [];
    for (const item of list) {
      items.push(mapPlexItem(item, base, token, section.type));
    }
  }
  return items;
}

function mapPlexItem(item, base, token, sectionType) {
  const posterPath = item.thumb ? `${base}${item.thumb}?X-Plex-Token=${token}` : undefined;
  const backdropPath = item.art ? `${base}${item.art}?X-Plex-Token=${token}` : undefined;
  return {
    title: item.title,
    media_type: sectionType === 'show' ? 'tv_show' : 'movie',
    description: item.summary || '',
    year: item.year ? Number(item.year) : undefined,
    rating: item.rating ? parseFloat(item.rating) : undefined,
    duration_minutes: item.duration ? Math.round(item.duration / 60000) : undefined,
    poster_url: posterPath,
    backdrop_url: backdropPath,
    genre: item.Genre?.map(g => g.tag) || [],
    director: item.Director?.[0]?.tag || undefined,
    cast: item.Role?.slice(0, 8).map(r => r.tag) || [],
    studio: item.studio || undefined,
    content_rating: item.contentRating || undefined,
    season_count: item.childCount ? Number(item.childCount) : undefined,
    tags: [],
  };
}

// ─── JELLYFIN ─────────────────────────────────────────────────────────────────

async function fetchJellyfinLibrary(server, onProgress) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const authHeaders = { 'X-Emby-Token': token, 'X-MediaBrowser-Token': token };

  const users = await proxyFetch(`${base}/Users`, authHeaders);
  const userList = Array.isArray(users) ? users : (users?.Items || []);
  if (!userList.length) throw new Error('Jellyfin auth failed. Check your API key and server URL.');
  const user = userList.find(u => u.Policy?.IsAdministrator) || userList[0];
  const userId = user.Id;

  const PAGE_SIZE = 200;
  const allItems = [];
  let startIndex = 0;
  let totalCount = 0;

  while (true) {
    const json = await proxyFetch(
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount&Limit=${PAGE_SIZE}&StartIndex=${startIndex}`,
      authHeaders
    );
    const items = json.Items || [];
    totalCount = json.TotalRecordCount || totalCount;
    allItems.push(...items.map(item => mapJellyfinItem(item, base, token)));
    if (onProgress) onProgress(allItems.length, totalCount || allItems.length);
    if (allItems.length >= totalCount || items.length < PAGE_SIZE) break;
    startIndex += PAGE_SIZE;
    await sleep(800);
  }

  return allItems;
}

function mapJellyfinItem(item, base, token) {
  const posterUrl = item.ImageTags?.Primary ? `${base}/Items/${item.Id}/Images/Primary?api_key=${token}` : undefined;
  const backdropUrl = item.BackdropImageTags?.[0] ? `${base}/Items/${item.Id}/Images/Backdrop/0?api_key=${token}` : undefined;
  const videoUrl = item.Type === 'Movie' ? `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true` : undefined;
  return {
    title: item.Name,
    media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear || undefined,
    rating: item.CommunityRating != null ? parseFloat(Number(item.CommunityRating).toFixed(1)) : undefined,
    duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    video_url: videoUrl,
    genre: item.Genres || [],
    director: item.People?.find(p => p.Type === 'Director')?.Name,
    cast: item.People?.filter(p => p.Type === 'Actor').slice(0, 8).map(p => p.Name) || [],
    studio: item.Studios?.[0]?.Name,
    content_rating: item.OfficialRating || undefined,
    season_count: item.ChildCount || undefined,
    tags: [],
  };
}

// ─── EMBY ─────────────────────────────────────────────────────────────────────

function buildEmbyImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&maxWidth=400`;
}

function mapEmbyItemForSync(item, base, token) {
  const hasPrimary = !!(item.ImageTags?.Primary);
  const hasBackdrop = !!(item.BackdropImageTags?.[0]);
  const tags = ['emby'];
  return {
    title: (item.Name || '').replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').trim(),
    media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear || undefined,
    rating: item.CommunityRating != null ? parseFloat(Number(item.CommunityRating).toFixed(1)) : undefined,
    duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
    poster_url: hasPrimary ? buildEmbyImageUrl(base, item.Id, token, 'Primary') : undefined,
    backdrop_url: hasBackdrop ? buildEmbyImageUrl(base, item.Id, token, 'Backdrop') : undefined,
    video_url: item.Type === 'Movie' ? `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true` : undefined,
    genre: item.Genres || [],
    director: item.People?.find(p => p.Type === 'Director')?.Name,
    cast: item.People?.filter(p => p.Type === 'Actor').slice(0, 8).map(p => p.Name) || [],
    studio: item.Studios?.[0]?.Name,
    season_count: item.ChildCount || undefined,
    tags,
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchEmbyLibrary(server, onProgress) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const authHeaders = { 'X-Emby-Token': token };

  // Step 1: resolve userId via proxy
  let userId;
  try {
    const me = await proxyFetch(`${base}/Users/Me`, authHeaders);
    userId = me?.Id;
  } catch (_) {}
  if (!userId) {
    const users = await proxyFetch(`${base}/Users`, authHeaders);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    userId = admin?.Id;
  }
  if (!userId) throw new Error('Could not authenticate with Emby. Check your API key.');

  // Step 2: get total count first so we can show accurate progress
  const countJson = await proxyFetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Limit=1&StartIndex=0`,
    authHeaders
  );
  const totalCount = countJson?.TotalRecordCount || 0;

  // Step 3: fetch all items via proxy with pacing to avoid overloading the server
  const PAGE = 200;
  let startIndex = 0;
  const allItems = [];

  while (true) {
    const json = await proxyFetch(
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
      `&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
      `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}`,
      authHeaders
    );
    const items = json.Items || [];
    for (const item of items) {
      allItems.push(mapEmbyItemForSync(item, base, token));
    }
    const fetched = Math.min(startIndex + items.length, totalCount || allItems.length);
    const total = totalCount || allItems.length;
    if (onProgress) onProgress(fetched, total);
    if (items.length < PAGE) break;
    startIndex += PAGE;
    await sleep(800);
  }

  return allItems;
}

// ─── XTREAM CODES ─────────────────────────────────────────────────────────────

async function fetchXtreamLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const username = server.username || '';
  const password = server.password || '';
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  const apiBase = `${base}/player_api.php?username=${u}&password=${p}`;

  const authData = await proxyFetch(apiBase);
  const authVal = authData?.user_info?.auth;
  if (authVal !== undefined && authVal !== null && Number(authVal) === 0) {
    throw new Error('Xtream authentication failed. Check your username and password.');
  }

  const [vodList, seriesList] = await Promise.all([
    proxyFetch(`${apiBase}&action=get_vod_streams`).catch(() => []),
    proxyFetch(`${apiBase}&action=get_series`).catch(() => []),
  ]);

  const safeArray = (d) => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);

  const items = [];

  for (const v of safeArray(vodList)) {
    if (!v || typeof v !== 'object') continue;
    const ext = v.container_extension || v.format || 'mp4';
    const streamUrl = `${base}/movie/${username}/${password}/${v.stream_id}.${ext}`;
    const rating = parseFloat(v.rating || v.rating_5based || 0);
    items.push({
      title: v.name || String(v.stream_id),
      media_type: 'movie',
      description: v.plot || '',
      year: v.year ? Number(v.year) : undefined,
      rating: rating > 0 ? rating : undefined,
      duration_minutes: v.duration_secs ? Math.round(Number(v.duration_secs) / 60)
        : v.duration ? Math.round(Number(v.duration) / 60) : undefined,
      poster_url: v.stream_icon || v.cover || undefined,
      genre: v.genre ? v.genre.split(',').map(g => g.trim()).filter(Boolean) : [],
      director: v.director || undefined,
      cast: v.cast ? v.cast.split(',').map(c => c.trim()).filter(Boolean).slice(0, 8) : [],
      video_url: streamUrl,
      tags: ['xtream', 'iptv'],
    });
  }

  for (const s of safeArray(seriesList)) {
    if (!s || typeof s !== 'object') continue;
    const rating = parseFloat(s.rating || s.rating_5based || 0);
    items.push({
      title: s.name || String(s.series_id),
      media_type: 'tv_show',
      description: s.plot || '',
      year: s.year ? Number(s.year) : undefined,
      rating: rating > 0 ? rating : undefined,
      poster_url: s.cover || s.stream_icon || undefined,
      genre: s.genre ? s.genre.split(',').map(g => g.trim()).filter(Boolean) : [],
      director: s.director || undefined,
      cast: s.cast ? s.cast.split(',').map(c => c.trim()).filter(Boolean).slice(0, 8) : [],
      season_count: s.num_seasons ? Number(s.num_seasons) : undefined,
      tags: ['xtream', 'iptv'],
    });
  }

  return items;
}

// ─── PING ─────────────────────────────────────────────────────────────────────

async function pingServer(server) {
  const base = server.server_url?.replace(/\/$/, '');
  if (!base) throw new Error('No server URL');
  let pingUrl;
  if (server.server_type === 'plex') {
    const token = server.api_token || server.plex_token;
    pingUrl = `${base}/identity?X-Plex-Token=${token}`;
  } else if (server.server_type === 'xtream') {
    const u = encodeURIComponent(server.username || '');
    const p = encodeURIComponent(server.password || '');
    pingUrl = `${base}/player_api.php?username=${u}&password=${p}&action=get_server_info`;
  } else {
    pingUrl = `${base}/System/Info/Public`;
  }
  await proxyFetch(pingUrl);
  return [];
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

function normaliseUrl(url) {
  if (!url) return url;
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  return url.replace(/\/$/, '');
}

export async function fetchServerLibrary(server, onProgress) {
  if (server.server_url) {
    server = { ...server, server_url: normaliseUrl(server.server_url) };
  }
  if (server._pingOnly) return pingServer(server);

  switch (server.server_type) {
    case 'plex':     return fetchPlexLibrary(server);
    case 'jellyfin': return fetchJellyfinLibrary(server, onProgress);
    case 'emby':     return fetchEmbyLibrary(server, onProgress);
    case 'xtream':   return fetchXtreamLibrary(server);
    default:
      throw new Error(`Unknown server type "${server.server_type}". Please reconnect this server.`);
  }
}