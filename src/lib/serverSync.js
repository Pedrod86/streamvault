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

  return {
    title: item.Name,
    media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear || undefined,
    rating: item.CommunityRating ? parseFloat(item.CommunityRating.toFixed(1)) : undefined,
    duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
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

async function fetchEmbyLibrary(server) {
  const base = server.server_url.replace(/\/$/, '');
  const token = server.api_token;
  const headers = {
    'X-Emby-Token': token,
    Accept: 'application/json',
  };

  const userRes = await fetch(`${base}/Users/Me`, { headers });
  const user = await userRes.json();
  const userId = user.Id;

  const res = await fetch(
    `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount&Limit=500`,
    { headers }
  );
  const json = await res.json();
  return (json.Items || []).map(item => mapJellyfinItem(item, base, token));
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function fetchServerLibrary(server) {
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