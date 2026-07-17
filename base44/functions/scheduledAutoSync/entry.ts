import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Server-side counterpart to the in-app "sync interval" setting.
// Runs every 5 minutes via a scheduled automation, but only actually syncs when
// enough time has elapsed since the last run to honor the user's saved
// sync_interval_minutes setting. Pulls the newest items from Emby and adds any
// that aren't already in the database — so the library stays fresh even when the
// app is closed.

const PAGE = 200;
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
  throw new Error('Could not authenticate with Emby.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only: block unauthenticated / non-admin callers before any service-role work
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;

    // Read the user's saved interval setting
    const settingsList = await withRetry(() => sr.entities.AppSettings.list('-created_date', 1));
    const settings = settingsList[0];
    const syncMinutes = settings?.sync_interval_minutes ?? 0;

    // 0 = disabled
    if (!syncMinutes || syncMinutes <= 0) {
      return Response.json({ skipped: true, reason: 'Auto-sync disabled (interval is 0).' });
    }

    // Honor the interval: only run if enough time has passed since the last sync
    const lastLogs = await withRetry(
      () => sr.entities.SyncLog.filter({ server_type: 'emby' }, '-created_date', 1)
    ).catch(() => []);
    const lastRun = lastLogs[0]?.created_date ? new Date(lastLogs[0].created_date).getTime() : 0;
    const elapsedMin = (Date.now() - lastRun) / 60000;
    if (lastRun && elapsedMin < syncMinutes) {
      return Response.json({ skipped: true, reason: `Only ${Math.round(elapsedMin)}m since last sync; interval is ${syncMinutes}m.` });
    }

    // Resolve active Emby server
    const servers = await withRetry(() => sr.entities.MediaServer.list());
    const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    // Dedup set from existing emby-tagged media (capped read)
    const existingEmbyIds = new Set();
    const existingPage = await withRetry(
      () => sr.entities.Media.filter({ tags: 'emby' }, '-created_date', 5000)
    ).catch(() => []);
    for (const m of existingPage) {
      const embyTag = Array.isArray(m.tags) ? m.tags.find(t => typeof t === 'string' && t.startsWith('emby:')) : null;
      if (embyTag) existingEmbyIds.add(embyTag.replace('emby:', ''));
    }

    // Pull newest items first — recent additions are what an interval sync cares about
    const url =
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
      `&Fields=Overview,Genres,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ImageTags,BackdropImageTags,Height,Width,Tags,DateCreated` +
      `&SortBy=DateCreated&SortOrder=Descending&Limit=${PAGE}&StartIndex=0&api_key=${token}`;

    const json = await doFetch(url);
    const rawItems = json?.Items || [];

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

    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH) {
      await withRetry(() => sr.entities.Media.bulkCreate(newItems.slice(i, i + BATCH)));
      createdCount += Math.min(BATCH, newItems.length - i);
      if (i + BATCH < newItems.length) await sleep(400);
    }

    // Log this run so the interval gate works next time
    await sr.entities.SyncLog.create({
      server_id: server.id || 'unknown',
      server_name: server.server_name || 'Emby',
      server_type: 'emby',
      status: 'success',
      items_fetched: rawItems.length,
      items_created: createdCount,
      items_updated: 0,
      duration_seconds: 0,
      started_at: new Date().toISOString(),
      description: `Scheduled auto-sync added ${createdCount} new items`,
    }).catch(() => {});

    if (createdCount > 0) {
      sr.functions.invoke('discordSyncAlert', {
        data: {
          server_name: server.server_name || 'Emby',
          server_type: 'emby',
          status: 'success',
          items_fetched: rawItems.length,
          items_created: createdCount,
          items_updated: 0,
          duration_seconds: 0,
        }
      }).catch(() => {});
    }

    return Response.json({ success: true, fetched: rawItems.length, created: createdCount, interval_minutes: syncMinutes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});