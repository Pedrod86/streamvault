import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH = 100;
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

    // Build the list of specific emby: tags we need to check for THIS batch only
    const embyIds = items.map(i => i.emby_id).filter(Boolean);

    // Check in chunks of 10 sequentially — avoids rate limit spikes
    const existingEmbyIds = new Set();
    for (let i = 0; i < embyIds.length; i += 10) {
      const chunk = embyIds.slice(i, i + 10);
      const checks = await Promise.all(
        chunk.map(eid =>
          base44.entities.Media.filter({ tags: `emby:${eid}` }, '-created_date', 1)
            .then(r => r.length > 0 ? eid : null)
            .catch(() => null)
        )
      );
      checks.forEach(eid => { if (eid) existingEmbyIds.add(eid); });
      if (i + 10 < embyIds.length) await sleep(300);
    }

    // Filter to only genuinely new items
    const newItems = items.filter(item => item.emby_id && !existingEmbyIds.has(item.emby_id));

    // Bulk create sequentially to avoid rate limits
    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH) {
      await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH));
      createdCount += Math.min(BATCH, newItems.length - i);
      if (i + BATCH < newItems.length) await sleep(500);
    }

    const duration = Math.round((Date.now() - t0) / 1000);

    // Count total items in DB after sync (fetch just IDs with high limit)
    const allMedia = await base44.entities.Media.list('-created_date', 10000).catch(() => []);
    const totalInDb = allMedia.length;

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
      description: `Total in library: ${totalInDb}`,
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
          total_in_db: totalInDb,
        }
      }).catch(() => {});
    }

    return Response.json({ success: true, fetched: items.length, created: createdCount, updated: 0, total_in_db: totalInDb });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});