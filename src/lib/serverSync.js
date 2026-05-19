/**
 * Fetches library items from Plex, Emby, or Jellyfin servers
 * and maps them to our Media entity shape.
 */

// ─── PLEX ────────────────────────────────────────────────────────────────────

async function fetchPlexLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.plex_token || server.api_token;
  const headers = { Accept: 'application/json' };

  // Get all library sections
  const sectionsRes = await fetch(
    `${base}/library/sections?X-Plex-Token=${token}`,
    { headers }
  );
  if (!sectionsRes.ok) throw new Error(`Plex auth failed (${sectionsRes.status}). Check your token and server URL.`);
  const sectionsJson = await safeJson(sectionsRes);
  const sections = sectionsJson?.MediaContainer?.Directory || [];

  const items = [];
  for (const section of sections) {
    if (!['movie', 'show'].includes(section.type)) continue;
    const res = await fetch(
      `${base}/library/sections/${section.key}/all?X-Plex-Token=${token}`,
      { headers }
    );
    const json = await safeJson(res);
    const list = json?.MediaContainer?.Metadata || [];
    for (const item of list) {
      items.push(mapPlexItem(item, base, token, section.type));
    }
  }
  return items;
}

function mapPlexItem(item, base, token, sectionType) {
  const posterPath = item.thumb
    ? `${base}${item.thumb}?X-Plex-Token=${token}`
    : undefined;
  const backdropPath = item.art
    ? `${base}${item.art}?X-Plex-Token=${token}`
    : undefined;

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

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON response (status ${res.status}). Check the server URL includes http:// or https:// and the correct port.`);
  }
}

async function fetchJellyfinLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const headers = {
    'X-Emby-Token': token,
    'X-MediaBrowser-Token': token,
    Accept: 'application/json',
  };

  // Get user id first
  const userRes = await fetch(`${base}/Users/Me`, { headers });
  if (!userRes.ok) throw new Error(`Jellyfin auth failed (${userRes.status}). Check your API key and server URL.`);
  const user = await safeJson(userRes);
  const userId = user.Id;

  // Get all items (movies + series)
  const res = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount&Limit=500`,
    { headers }
  );
  if (!res.ok) throw new Error(`Jellyfin library fetch failed (${res.status}).`);
  const json = await safeJson(res);
  return (json.Items || []).map(item => mapJellyfinItem(item, base, token));
}

function mapJellyfinItem(item, base, token) {
  const posterUrl = item.ImageTags?.Primary
    ? `${base}/Items/${item.Id}/Images/Primary?api_key=${token}`
    : undefined;
  const backdropUrl = item.BackdropImageTags?.[0]
    ? `${base}/Items/${item.Id}/Images/Backdrop/0?api_key=${token}`
    : undefined;

  let videoUrl;
  if (item.Type === 'Movie') {
    videoUrl = `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true`;
  }

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
// Emby API is nearly identical to Jellyfin

async function authenticateEmby(base, username, password) {
  const res = await fetch(`${base}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': 'MediaBrowser Client="StreamVault", Device="Browser", DeviceId="streamvault", Version="1.0.0"',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  if (!res.ok) throw new Error('Emby authentication failed. Check your username/password.');
  const data = await res.json();
  return { token: data.AccessToken, userId: data.User?.Id };
}

async function fetchEmbyLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  let token = server.api_token;
  let userId;

  // If no token but we have credentials, authenticate first
  if (!token && server.username && server.password) {
    const auth = await authenticateEmby(base, server.username, server.password);
    token = auth.token;
    userId = auth.userId;
  }

  if (!token) throw new Error('No API token available for Emby. Please reconnect with an API key.');

  const headers = {
    'X-Emby-Token': token,
    Accept: 'application/json',
  };

  if (!userId) {
    const userRes = await fetch(`${base}/Users/Me`, { headers });
    if (!userRes.ok) throw new Error('Could not authenticate with Emby server.');
    const user = await safeJson(userRes);
    userId = user.Id;
  }

  const res = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,MediaSources&Limit=500`,
    { headers }
  );
  if (!res.ok) throw new Error(`Emby library fetch failed (${res.status}).`);
  const json = await safeJson(res);
  return (json.Items || []).map(item => mapEmbyItem(item, base, token));
}

function mapEmbyItem(item, base, token) {
  const posterUrl = item.ImageTags?.Primary
    ? `${base}/Items/${item.Id}/Images/Primary?api_key=${token}`
    : undefined;
  const backdropUrl = item.BackdropImageTags?.[0]
    ? `${base}/Items/${item.Id}/Images/Backdrop/0?api_key=${token}`
    : undefined;

  // Build a direct stream URL for movies (video playback)
  let videoUrl;
  if (item.Type === 'Movie') {
    videoUrl = `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true`;
  }

  const communityRating = item.CommunityRating != null ? parseFloat(Number(item.CommunityRating).toFixed(1)) : undefined;

  return {
    title: item.Name || '',
    media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear ? Number(item.ProductionYear) : undefined,
    rating: !isNaN(communityRating) ? communityRating : undefined,
    duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    video_url: videoUrl,
    genre: Array.isArray(item.Genres) ? item.Genres : [],
    director: item.People?.find(p => p.Type === 'Director')?.Name || undefined,
    cast: item.People?.filter(p => p.Type === 'Actor').slice(0, 8).map(p => p.Name) || [],
    studio: item.Studios?.[0]?.Name || undefined,
    content_rating: item.OfficialRating || undefined,
    season_count: item.ChildCount ? Number(item.ChildCount) : undefined,
    tags: [],
  };
}

// ─── XTREAM CODES ─────────────────────────────────────────────────────────────

async function safeXtreamJson(res) {
  try {
    const text = await res.text();
    const parsed = JSON.parse(text);
    // Some providers wrap list in an object — unwrap to array
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
  } catch {
    return [];
  }
}

async function fetchXtreamLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const username = server.username || '';
  const password = server.password || '';
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  // Support providers that use a path prefix like /api/ (e.g. base = http://host:port/api)
  const apiBase = `${base}/player_api.php?username=${u}&password=${p}`;

  // First verify auth
  let authRes;
  try {
    authRes = await fetch(apiBase);
  } catch {
    throw new Error('Cannot reach your Xtream server. Check the URL and your network connection.');
  }
  if (!authRes.ok) throw new Error(`Xtream server responded with status ${authRes.status}.`);

  let authData;
  try {
    const text = await authRes.text();
    authData = JSON.parse(text);
  } catch {
    throw new Error('Xtream server returned an invalid response. Ensure the URL and credentials are correct.');
  }

  const authVal = authData?.user_info?.auth;
  if (authVal !== undefined && authVal !== null && Number(authVal) === 0) {
    throw new Error('Xtream authentication failed. Check your username and password.');
  }

  // Fetch VOD (movies) and Series in parallel
  const [vodRes, seriesRes] = await Promise.all([
    fetch(`${apiBase}&action=get_vod_streams`).catch(() => null),
    fetch(`${apiBase}&action=get_series`).catch(() => null),
  ]);

  const [vodList, seriesList] = await Promise.all([
    vodRes ? safeXtreamJson(vodRes) : [],
    seriesRes ? safeXtreamJson(seriesRes) : [],
  ]);

  const items = [];

  for (const v of vodList) {
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

  for (const s of seriesList) {
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

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

function normaliseUrl(url) {
  if (!url) return url;
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  return url.replace(/\/$/, '');
}

export async function fetchServerLibrary(server) {
  // Normalise URL so bare IPs/hostnames work
  if (server.server_url) {
    server = { ...server, server_url: normaliseUrl(server.server_url) };
  }
  // _pingOnly: just check reachability, don't return full library
  if (server._pingOnly) {
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
    const res = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Server returned error');
    return [];
  }

  switch (server.server_type) {
    case 'plex':
      return fetchPlexLibrary(server);
    case 'jellyfin':
      return fetchJellyfinLibrary(server);
    case 'emby':
      return fetchEmbyLibrary(server);
    case 'xtream':
      return fetchXtreamLibrary(server);
    default:
      throw new Error(`Unknown server type "${server.server_type}". Please reconnect this server.`);
  }
}