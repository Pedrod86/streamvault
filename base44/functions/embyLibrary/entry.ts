import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry a platform/DB call with backoff when rate-limited (429)
async function withRetry(fn) {
  let delay = 600;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const is429 = e?.status === 429 || /rate limit/i.test(e?.message || '');
      if (!is429 || attempt === 4) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

// Module-level server cache — avoids hitting DB on every request
let _serverCache = null;
let _serverCacheAt = 0;
const SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getEmbyServer(base44) {
  const now = Date.now();
  if (_serverCache && (now - _serverCacheAt) < SERVER_CACHE_TTL) return _serverCache;
  const servers = await withRetry(() => base44.entities.MediaServer.list());
  const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false) || null;
  _serverCache = server;
  _serverCacheAt = now;
  return server;
}

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
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
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}&MaxWidth=400`;
}

function buildStreamUrl(base, itemId, token) {
  return `${base}/Videos/${itemId}/stream?api_key=${token}&Static=true`;
}

async function resolveUserId(base, token) {
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`);
    if (me?.Id) return me.Id;
  } catch (_) {}
  try {
    const users = await doFetch(`${base}/Users?api_key=${token}`);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
    if (admin?.Id) return admin.Id;
  } catch (_) {}
  throw new Error('Could not authenticate with Emby. Check your API token.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await withRetry(() => base44.auth.me());
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const startIndex = parseInt(body.startIndex || 0);
    const PAGE = parseInt(body.pageSize || 500);
    // itemType: 'Movie' | 'Series' | '' (both)
    const itemType = body.itemType || '';
    // search: free-text filter
    const searchTerm = (body.search || '').trim();
    // genre filter
    const genreFilter = (body.genre || '').trim();
    // years filter — comma-separated list of years (e.g. for a decade)
    const yearsFilter = (body.years || '').trim();

    const server = await getEmbyServer(base44);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    const types = itemType ? itemType : 'Movie,Series';

    // sortBy may be "SortName" or "CommunityRating,Descending"
    const sortBy = (body.sortBy || 'SortName').trim();
    const sortParts = sortBy.split(',');
    const sortField = sortParts[0] || 'SortName';
    const sortOrder = sortParts[1] || 'Ascending';

    let url =
      `${base}/Users/${userId}/Items?IncludeItemTypes=${types}&Recursive=true` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags,MediaStreams,Height,Width,Tags` +
      `&SortBy=${sortField}&SortOrder=${sortOrder}&Limit=${PAGE}&StartIndex=${startIndex}&api_key=${token}`;

    if (searchTerm) url += `&SearchTerm=${encodeURIComponent(searchTerm)}`;
    if (genreFilter) url += `&Genres=${encodeURIComponent(genreFilter)}`;
    if (yearsFilter) url += `&Years=${encodeURIComponent(yearsFilter)}`;

    const json = await doFetch(url);

    const rawItems = json?.Items || [];
    const total = json?.TotalRecordCount || 0;

    // For Series, the series object has no resolution (it lives on episodes).
    // Query each series' episodes for a 4K video stream and build a 4K lookup.
    const series4k = new Set();
    const seriesItems = rawItems.filter(it => it.Type === 'Series');
    await Promise.all(seriesItems.map(async (s) => {
      try {
        const epUrl =
          `${base}/Users/${userId}/Items?ParentId=${s.Id}&Recursive=true` +
          `&IncludeItemTypes=Episode&Fields=MediaStreams,Height,Width&Limit=400&api_key=${token}`;
        const epJson = await doFetch(epUrl);
        const eps = epJson?.Items || [];
        const has4k = eps.some(ep => {
          const vs = (ep.MediaStreams || []).find(st => st.Type === 'Video');
          return (ep.Height || 0) >= 2160 || (vs?.Height || 0) >= 2160 || (vs?.Width || 0) >= 3840;
        });
        if (has4k) series4k.add(s.Id);
      } catch (_) { /* skip series we can't read */ }
    }));

    const items = rawItems.map(item => {
      // Detect 4K: check Height field, MediaStreams, Emby Tags, or title keywords
      const height = item.Height || 0;
      const videoStream = (item.MediaStreams || []).find(s => s.Type === 'Video');
      const streamHeight = videoStream?.Height || 0;
      const maxHeight = Math.max(height, streamHeight);
      const embyTags = (item.Tags || []).map(t => t.toLowerCase());
      const is4k = maxHeight >= 2160 ||
        /\b(4K|UHD|2160p)\b/i.test(item.Name || '') ||
        (item.MediaStreams || []).some(s => s.Type === 'Video' && (s.Width >= 3840 || s.Height >= 2160)) ||
        embyTags.some(t => /4k|uhd|2160p/.test(t)) ||
        series4k.has(item.Id); // series flagged 4K via its episodes

      return {
        id: item.Id,
        title: item.Name,
        type: item.Type,
        year: item.ProductionYear || null,
        rating: item.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : null,
        duration: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
        overview: item.Overview || '',
        genres: item.Genres || [],
        contentRating: item.OfficialRating || null,
        posterUrl: item.ImageTags?.Primary ? buildImageUrl(base, item.Id, token, 'Primary') : null,
        backdropUrl: item.BackdropImageTags?.[0] ? buildImageUrl(base, item.Id, token, 'Backdrop') : null,
        streamUrl: buildStreamUrl(base, item.Id, token),
        is4k,
        height: maxHeight || null,
      };
    });

    return Response.json({
      items,
      total,
      startIndex,
      hasMore: startIndex + items.length < total,
      server: { id: server.id, server_name: server.server_name, server_url: base, api_token: token },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});