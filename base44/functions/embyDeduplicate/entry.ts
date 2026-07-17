import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch all media items using paginated requests with delays between pages
    let allMedia = [];
    let page = 0;
    const pageSize = 200;
    while (true) {
      await sleep(600); // generous pause between pages to avoid rate limits
      const batch = await base44.asServiceRole.entities.Media.list('-created_date', pageSize, page * pageSize);
      if (!batch || !batch.length) break;
      allMedia = [...allMedia, ...batch];
      if (batch.length < pageSize) break;
      page++;
    }

    // Build dedup sets — keep first occurrence (oldest = lowest created_date)
    // Sort ascending by created_date so we keep the oldest copy
    allMedia.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    const seenEmbyIds = new Set();
    const seenTitleType = new Set();
    const toDelete = [];

    for (const item of allMedia) {
      const embyTag = Array.isArray(item.tags)
        ? item.tags.find(t => typeof t === 'string' && t.startsWith('emby:'))
        : null;
      const embyId = embyTag ? embyTag.replace('emby:', '') : null;

      if (embyId) {
        if (seenEmbyIds.has(embyId)) {
          toDelete.push(item.id);
          continue;
        }
        seenEmbyIds.add(embyId);
      } else {
        const key = `${(item.title || '').toLowerCase().trim()}|${item.media_type || ''}`;
        if (seenTitleType.has(key)) {
          toDelete.push(item.id);
          continue;
        }
        seenTitleType.add(key);
      }
    }

    // Delete duplicates with rate-limit-friendly pacing (1 per 500ms)
    let deletedCount = 0;
    for (const id of toDelete) {
      await sleep(500);
      await base44.asServiceRole.entities.Media.delete(id).catch(() => {});
      deletedCount++;
    }

    return Response.json({
      success: true,
      total_scanned: allMedia.length,
      duplicates_found: toDelete.length,
      duplicates_deleted: deletedCount,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});