import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Self-contained bulk catch-up scan of the entire Emby library.
// Fetches directly from Emby (no per-series 4K episode lookups — those are slow
// and not needed for a bulk catch-up) and writes new items to the DB via service role.
// Persists progress on a ScanCursor row so it can be called repeatedly by a
// scheduled automation until the whole library is in the database.

const PAGE = 500;
const MAX_PAGES_PER_RUN = 5; // ~2500 items per run — safely within the function timeout
const BATCH = 50;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Emby HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUserId(base, token) {
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`);
    if (me?.Id) return me.Id;
  } catch (_) {}
  const users = await doFetch(`${base}/Users?api_key=${token}`);
  const list = Array.isArray(users) ? users : (users?.Items || []);
  const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
  if (admin?.Id) return admin.Id;
  throw new Error('Could not authenticate with Emby. Check your API token.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // Load or create the scan cursor
    let cursors = await withRetry(() => sr.entities.ScanCursor.list('-created_date', 1));
    let cursor = cursors[0];
    if (!cursor) {
      cursor = await withRetry(() => sr.entities.ScanCursor.create({ start_index: 0, total: 0, status: 'idle' }));
    }

    if (cursor.status === 'complete') {
      return Response.json({ done: true, message: 'Library scan already complete.', start_index: cursor.start_index, total: cursor.total });
    }

    // Resolve active Emby server
    const servers = await withRetry(() => sr.entities.MediaServer.list());
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    // Build a dedup set from existing emby-tagged media (capped read)
    const existingEmbyIds = new Set();
    const existingPage = await withRetry(
      () => sr.entities.Media.filter({ tags: 'emby' }, '-created_date', 5000)
    ).catch(() => []);
    for (const m of existingPage) {
      const embyTag = Array.isArray(m.tags) ? m.tags.find(t => typeof t === 'string' && t.startsWith('emby:')) : null;
      if (embyTag) existingEmbyIds.add(embyTag.replace('emby:', ''));
    }

    let startIndex = cursor.start_index || 0;
    let total = cursor.total || 0;
    let totalFetched = 0, totalCreated = 0;
    let finished = false;

    await withRetry(() => sr.entities.ScanCursor.update(cursor.id, { status: 'running' }));

    for (let p = 0; p < MAX_PAGES_PER_RUN; p++) {
      const url =
        `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
        `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,Height,Width,Tags` +
        `&SortBy=SortName&SortOrder=Ascending&Limit=${PAGE}&StartIndex=${startIndex}&api_key=${token}`;

      const json = await doFetch(url);
      const rawItems = json?.Items || [];
      if (json?.TotalRecordCount) total = json.TotalRecordCount;

      if (!rawItems.length) { finished = true; break; }
      totalFetched += rawItems.length;

      // Map + filter to genuinely new items
      const newItems = [];
      for (const item of rawItems) {
        if (!item.Id || existingEmbyIds.has(item.Id)) continue;
        existingEmbyIds.add(item.Id);

        const height = item.Height || 0;
        const is4k = height >= 2160 || /\b(4K|UHD|2160p)\b/i.test(item.Name || '') ||
          (item.Tags || []).some(t => /4k|uhd|2160p/i.test(t));

        const tags = ['emby', `emby:${item.Id}`];
        if (is4k) tags.push('4k');

        newItems.push({
          emby_id: item.Id,
          title: item.Name,
          media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
          description: item.Overview || '',
          year: item.ProductionYear || undefined,
          rating: item.CommunityRating ? parseFloat(Number(item.CommunityRating).toFixed(1)) : undefined,
          duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
          poster_url: item.ImageTags?.Primary ? `${base}/Items/${item.Id}/Images/Primary?api_key=${token}&MaxWidth=400` : undefined,
          backdrop_url: item.BackdropImageTags?.[0] ? `${base}/Items/${item.Id}/Images/Backdrop?api_key=${token}&MaxWidth=400` : undefined,
          video_url: `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true`,
          genre: item.Genres || [],
          tags,
        });
      }

      // Bulk-create new items in small batches
      for (let i = 0; i < newItems.length; i += BATCH) {
        await withRetry(() => sr.entities.Media.bulkCreate(newItems.slice(i, i + BATCH)));
        totalCreated += Math.min(BATCH, newItems.length - i);
        if (i + BATCH < newItems.length) await sleep(400);
      }

      startIndex += rawItems.length;
      await withRetry(() => sr.entities.ScanCursor.update(cursor.id, { start_index: startIndex, total }));

      if (startIndex >= total) { finished = true; break; }
    }

    await withRetry(() => sr.entities.ScanCursor.update(cursor.id, {
      start_index: startIndex,
      total,
      status: finished ? 'complete' : 'running',
    }));

    return Response.json({
      done: finished,
      start_index: startIndex,
      total,
      fetched_this_run: totalFetched,
      created_this_run: totalCreated,
      progress: total ? `${Math.min(startIndex, total)}/${total}` : `${startIndex}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});