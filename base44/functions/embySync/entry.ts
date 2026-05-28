import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH = 50;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const server = body.server;
    const items = body.items;

    if (!server) return Response.json({ error: 'Missing server' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ success: true, fetched: 0, created: 0, updated: 0 });
    }

    // Build lookup maps from the items in this sync batch only
    // We check against existing records tagged with 'emby' (fetched in one page)
    // to avoid massive full-table scans that cause timeouts.
    const existingEmbyIds = new Set();
    const existingTitleType = new Set();

    // Fetch existing emby-tagged media — limit to 1000 to stay fast
    // Most libraries are well under 1000 items per sync page
    const existingPage = await base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 1000).catch(() => []);
    for (const m of existingPage) {
      const embyTag = Array.isArray(m.tags) ? m.tags.find(t => typeof t === 'string' && t.startsWith('emby:')) : null;
      if (embyTag) existingEmbyIds.add(embyTag.replace('emby:', ''));
      existingTitleType.add(`${(m.title || '').toLowerCase().trim()}|${m.media_type}`);
    }

    // If library is larger than 1000, do a second page
    if (existingPage.length >= 1000) {
      const page2 = await base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 2000).catch(() => []);
      for (const m of page2.slice(1000)) {
        const embyTag = Array.isArray(m.tags) ? m.tags.find(t => typeof t === 'string' && t.startsWith('emby:')) : null;
        if (embyTag) existingEmbyIds.add(embyTag.replace('emby:', ''));
        existingTitleType.add(`${(m.title || '').toLowerCase().trim()}|${m.media_type}`);
      }
    }

    // Filter to only genuinely new items
    const newItems = items.filter(item => {
      if (!item.emby_id) return false;
      if (existingEmbyIds.has(item.emby_id)) return false;
      const key = `${(item.title || '').toLowerCase().trim()}|${item.media_type}`;
      if (existingTitleType.has(key)) return false;
      // Track within this batch to avoid double-insert
      existingEmbyIds.add(item.emby_id);
      existingTitleType.add(key);
      return true;
    });

    // Bulk create in small batches with pacing
    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH) {
      await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH));
      createdCount += Math.min(BATCH, newItems.length - i);
      if (i + BATCH < newItems.length) await sleep(300);
    }

    const duration = Math.round((Date.now() - t0) / 1000);

    // Fire-and-forget log + discord
    base44.entities.SyncLog.create({
      server_id: server?.id || 'unknown',
      server_name: server?.server_name || 'Emby',
      server_type: 'emby',
      status: 'success',
      items_fetched: items.length,
      items_created: createdCount,
      items_updated: 0,
      duration_seconds: duration,
      started_at: startedAt,
      description: `Synced ${createdCount} new items`,
    }).catch(() => {});

    if (createdCount > 0) {
      base44.asServiceRole.functions.invoke('discordSyncAlert', {
        data: {
          server_name: server?.server_name || 'Emby',
          server_type: 'emby',
          status: 'success',
          items_fetched: items.length,
          items_created: createdCount,
          items_updated: 0,
          duration_seconds: duration,
        }
      }).catch(() => {});
    }

    return Response.json({ success: true, fetched: items.length, created: createdCount, updated: 0 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});