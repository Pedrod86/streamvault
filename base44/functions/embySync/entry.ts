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

    // Pull ALL existing emby tags in ONE query (tag prefix "emby:")
    // We fetch up to 5000 existing records and build a Set of known emby IDs
    const existing = await base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 5000);
    const existingEmbyIds = new Set();
    for (const m of existing) {
      for (const t of (m.tags || [])) {
        if (t.startsWith('emby:')) existingEmbyIds.add(t.slice(5));
      }
    }

    // Filter to only genuinely new items
    const newItems = items.filter(item => item.emby_id && !existingEmbyIds.has(item.emby_id));

    // Bulk create in parallel batches of 100
    let createdCount = 0;
    const batches = [];
    for (let i = 0; i < newItems.length; i += BATCH) {
      batches.push(newItems.slice(i, i + BATCH));
    }

    // Run up to 3 batch creates in parallel
    for (let i = 0; i < batches.length; i += 3) {
      await Promise.all(
        batches.slice(i, i + 3).map(b => base44.entities.Media.bulkCreate(b))
      );
      createdCount += batches.slice(i, i + 3).reduce((sum, b) => sum + b.length, 0);
      if (i + 3 < batches.length) await sleep(100);
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