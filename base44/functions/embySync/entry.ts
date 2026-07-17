import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH = 50;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry a DB operation with exponential backoff when the platform returns 429 (rate limit)
async function withRetry(fn, label = 'op') {
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

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await withRetry(() => base44.auth.me());
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Syncing writes to the shared Media catalogue and triggers privileged
    // (asServiceRole) Discord alerts — restrict to admins only.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const server = body.server;
    const items = body.items;
    const isJellyfin = server?.server_type === 'jellyfin';

    if (!server) return Response.json({ error: 'Missing server' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ success: true, fetched: 0, created: 0, updated: 0 });
    }

    // Build lookup maps to dedup against existing content.
    // For Jellyfin we want to integrate into the EXISTING (mostly Emby) catalogue:
    // skip anything already present by title+type, and merge a Jellyfin playback
    // reference onto the matching record instead of creating a duplicate.
    const existingSourceIds = new Set();
    const existingByTitleType = new Map();

    // Read one capped page of the catalogue we're deduping against.
    const sourcePrefix = isJellyfin ? 'jellyfin' : 'emby';
    const existingPage = await withRetry(
      () => base44.entities.Media.filter({ tags: sourcePrefix }, '-created_date', 1000),
      'read-existing'
    ).catch(() => []);
    // Jellyfin also needs to see the existing catalogue (emby-tagged) to merge into it.
    const otherPage = isJellyfin
      ? await withRetry(() => base44.entities.Media.filter({ tags: 'emby' }, '-created_date', 1000), 'read-emby').catch(() => [])
      : [];

    for (const m of [...existingPage, ...otherPage]) {
      const idTag = Array.isArray(m.tags) ? m.tags.find(t => typeof t === 'string' && t.startsWith(`${sourcePrefix}:`)) : null;
      if (idTag) existingSourceIds.add(idTag.replace(`${sourcePrefix}:`, ''));
      const key = `${(m.title || '').toLowerCase().trim()}|${m.media_type}`;
      if (!existingByTitleType.has(key)) existingByTitleType.set(key, m);
    }

    const sourceIdField = isJellyfin ? 'jellyfin_id' : 'emby_id';
    const newItems = [];
    const merges = []; // { record, item } — existing records to enrich with a Jellyfin reference

    for (const item of items) {
      const srcId = item[sourceIdField];
      if (!srcId) continue;
      if (existingSourceIds.has(srcId)) continue; // already synced from this source
      const key = `${(item.title || '').toLowerCase().trim()}|${item.media_type}`;

      const match = existingByTitleType.get(key);
      if (match) {
        // Already in the catalogue. For Jellyfin, attach a jellyfin reference so
        // the user can choose to play it from Jellyfin — but don't duplicate.
        if (isJellyfin && !(match.tags || []).some(t => t?.startsWith('jellyfin:'))) {
          merges.push({ record: match, item });
        }
        existingSourceIds.add(srcId);
        continue;
      }

      // Genuinely new — insert it.
      existingSourceIds.add(srcId);
      existingByTitleType.set(key, { ...item });
      newItems.push(item);
    }

    // Merge Jellyfin references onto existing (Emby) records so both play options exist.
    let mergedCount = 0;
    for (const { record, item } of merges) {
      const mergedTags = [...new Set([...(record.tags || []), 'jellyfin', `jellyfin:${item.jellyfin_id}`])];
      await withRetry(() => base44.entities.Media.update(record.id, {
        tags: mergedTags,
        jellyfin_url: item.video_url || undefined,
      }), 'merge-jellyfin').catch(() => {});
      mergedCount++;
      if (mergedCount % BATCH === 0) await sleep(300);
    }

    // Bulk create in small batches with pacing
    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH) {
      await withRetry(() => base44.entities.Media.bulkCreate(newItems.slice(i, i + BATCH)), 'bulk-create');
      createdCount += Math.min(BATCH, newItems.length - i);
      if (i + BATCH < newItems.length) await sleep(500);
    }

    const duration = Math.round((Date.now() - t0) / 1000);

    const serverType = server?.server_type || 'emby';

    // Fire-and-forget log + discord
    base44.entities.SyncLog.create({
      server_id: server?.id || 'unknown',
      server_name: server?.server_name || serverType,
      server_type: serverType,
      status: 'success',
      items_fetched: items.length,
      items_created: createdCount,
      items_updated: mergedCount,
      duration_seconds: duration,
      started_at: startedAt,
      description: `Synced ${createdCount} new, merged ${mergedCount} existing`,
    }).catch(() => {});

    if (createdCount > 0) {
      base44.asServiceRole.functions.invoke('discordSyncAlert', {
        data: {
          server_name: server?.server_name || serverType,
          server_type: serverType,
          status: 'success',
          items_fetched: items.length,
          items_created: createdCount,
          items_updated: mergedCount,
          duration_seconds: duration,
        }
      }).catch(() => {});
    }

    // How many items in this page were already in the DB — lets the caller stop
    // early once it reaches a page of entirely-known content.
    const alreadyExisting = items.length - newItems.length;
    const allExisting = newItems.length === 0 && items.length > 0;

    return Response.json({ success: true, fetched: items.length, created: createdCount, updated: mergedCount, alreadyExisting, allExisting });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});