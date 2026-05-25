import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    const user = await base44.auth.me();
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

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
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

    const json = await doFetch(url);

    const rawItems = json?.Items || [];
    const total = json?.TotalRecordCount || 0;

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
        embyTags.some(t => /4k|uhd|2160p/.test(t));

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