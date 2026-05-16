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
  const sectionsJson = await sectionsRes.json();
  const sections = sectionsJson?.MediaContainer?.Directory || [];

  const items = [];
  for (const section of sections) {
    if (!['movie', 'show'].includes(section.type)) continue;
    const res = await fetch(
      `${base}/library/sections/${section.key}/all?X-Plex-Token=${token}`,
      { headers }
    );
    const json = await res.json();
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
  const user = await userRes.json();
  const userId = user.Id;

  // Get all items (movies + series)
  const res = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount&Limit=500`,
    { headers }
  );
  const json = await res.json();
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
    const user = await userRes.json();
    userId = user.Id;
  }

  const res = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,MediaSources&Limit=500`,
    { headers }
  );
  const json = await res.json();
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

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function fetchServerLibrary(server) {
  // _pingOnly: just check reachability, don't return full library
  if (server._pingOnly) {
    const base = server.server_url?.replace(/\/$/, '');
    if (!base) throw new Error('No server URL');
    const token = server.api_token || server.plex_token;
    const pingUrl = server.server_type === 'plex'
      ? `${base}/identity?X-Plex-Token=${token}`
      : `${base}/System/Info/Public`;
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
    default:
      throw new Error(`Unsupported server type: ${server.server_type}`);
  }
}