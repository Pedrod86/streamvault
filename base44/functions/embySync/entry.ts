import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function now acts as a thin authenticated wrapper.
// All Emby API calls are made client-side via mediaProxy (which the browser proxies).
// embySync is only called to write items to the DB with proper user auth context.

const BATCH_WRITE = 50;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  let base44Client, parsedServer;

  try {
    base44Client = createClientFromRequest(req);
    const user = await base44Client.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    parsedServer = body.server;
    const items = body.items; // pre-fetched items from client via mediaProxy
    const { server } = body;

    if (!server) return Response.json({ error: 'Missing server' }, { status: 400 });
    if (!Array.isArray(items)) return Response.json({ error: 'Missing items array' }, { status: 400 });

    const base44 = base44Client;

    // Load existing media for dedup — paginated
    const existingMap = new Map();
    let existingPage = 0;
    const PAGE_DB = 500;
    while (true) {
      const page = await base44.entities.Media.list('-created_date', PAGE_DB, existingPage * PAGE_DB);
      for (const m of page) existingMap.set(m.title.toLowerCase().trim(), m);
      if (page.length < PAGE_DB) break;
      existingPage++;
      await sleep(400);
    }

    const newItems = [];
    const updateItems = [];

    for (const item of items) {
      const key = item.title?.toLowerCase().trim();
      if (!key) continue;
      const existing = existingMap.get(key);
      if (existing) {
        if (existing.id && item.video_url && !existing.video_url) {
          updateItems.push({ id: existing.id, video_url: item.video_url });
        }
      } else {
        newItems.push(item);
        existingMap.set(key, { _sentinel: true });
      }
    }

    // Bulk create new items
    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH_WRITE) {
      await base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH_WRITE));
      createdCount += Math.min(BATCH_WRITE, newItems.length - i);
      await sleep(300);
    }

    // Update existing items missing video_url
    let updatedCount = 0;
    for (let i = 0; i < updateItems.length; i += BATCH_WRITE) {
      const batch = updateItems.slice(i, i + BATCH_WRITE);
      await Promise.all(batch.map(u => base44.entities.Media.update(u.id, { video_url: u.video_url })));
      updatedCount += batch.length;
      await sleep(300);
    }

    const duration = Math.round((Date.now() - t0) / 1000);

    await base44.entities.SyncLog.create({
      server_id: parsedServer?.id || server.id || 'unknown',
      server_name: server.server_name || 'Emby',
      server_type: 'emby',
      status: 'success',
      items_fetched: items.length,
      items_created: createdCount,
      items_updated: updatedCount,
      duration_seconds: duration,
      started_at: startedAt,
    });

    return Response.json({ success: true, fetched: items.length, created: createdCount, updated: updatedCount });

  } catch (error) {
    const duration = Math.round((Date.now() - t0) / 1000);
    const msg = error.message || String(error);
    try {
      if (base44Client) {
        await base44Client.entities.SyncLog.create({
          server_id: parsedServer?.id || 'unknown',
          server_name: parsedServer?.server_name || 'Emby',
          server_type: 'emby',
          status: 'error',
          error_message: msg,
          duration_seconds: duration,
          started_at: startedAt,
        });
      }
    } catch (_) {}
    return Response.json({ error: msg }, { status: 500 });
  }
});