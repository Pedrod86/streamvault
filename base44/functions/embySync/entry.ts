import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAGE_SIZE = 200; // smaller pages = fewer connection drops
const MAX_RETRIES = 3;
const BATCH_WRITE = 50;

function buildImageUrl(base, itemId, token, type = 'Primary') {
  return `${base}/Items/${itemId}/Images/${type}?api_key=${token}`;
}

function sanitizeTitle(t) {
  if (!t) return '';
  return t.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').trim();
}

function normalizeRating(r) {
  if (r == null) return undefined;
  const n = parseFloat(r);
  if (isNaN(n)) return undefined;
  return parseFloat(Math.min(10, Math.max(0, n)).toFixed(1));
}

const RATING_MAP = [
  [/^G$/i,      'G'],
  [/^PG$/i,     'PG'],
  [/^PG-?13$/i, 'PG-13'],
  [/^R$/i,      'R'],
  [/^NC-?17$/i, 'NC-17'],
  [/^TV-?Y$/i,  'TV-Y'],
  [/^TV-?G$/i,  'TV-G'],
  [/^TV-?PG$/i, 'TV-PG'],
  [/^TV-?14$/i, 'TV-14'],
  [/^TV-?MA$/i, 'TV-MA'],
];
function mapContentRating(r) {
  if (!r) return undefined;
  for (const [re, val] of RATING_MAP) {
    if (re.test(r.trim())) return val;
  }
  return undefined;
}

function mapItem(item, base, token) {
  const hasPrimary = !!(item.ImageTags?.Primary);
  const hasBackdrop = !!(item.BackdropImageTags?.[0]);
  const tags = ['emby'];
  if (item.Type === 'Movie' && item.MediaSources?.[0]?.MediaStreams?.some(s => s.Width >= 3840)) tags.push('4k');
  return {
    title: sanitizeTitle(item.Name),
    media_type: item.Type === 'Series' ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear || undefined,
    rating: normalizeRating(item.CommunityRating),
    duration_minutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : undefined,
    poster_url: hasPrimary ? buildImageUrl(base, item.Id, token, 'Primary') : undefined,
    backdrop_url: hasBackdrop ? buildImageUrl(base, item.Id, token, 'Backdrop') : undefined,
    video_url: item.Type === 'Movie' ? `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true` : undefined,
    genre: item.Genres || [],
    director: item.People?.find(p => p.Type === 'Director')?.Name,
    cast: item.People?.filter(p => p.Type === 'Actor').slice(0, 8).map(p => p.Name) || [],
    studio: item.Studios?.[0]?.Name,
    content_rating: mapContentRating(item.OfficialRating),
    season_count: item.ChildCount || undefined,
    tags,
  };
}

async function fetchWithRetry(url, headers, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (attempt === retries) throw err;
      // Exponential back-off: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { server } = await req.json();
    if (!server) return Response.json({ error: 'Missing server' }, { status: 400 });

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    if (!token) return Response.json({ error: 'No API token for Emby server' }, { status: 400 });

    const authHeaders = { 'X-Emby-Token': token, 'Accept': 'application/json' };

    // Resolve user ID — try /Users/Me first (works with most Emby API keys),
    // fall back to /Users list if that fails
    let userId;
    try {
      const me = await fetchWithRetry(`${base}/Users/Me`, authHeaders);
      userId = me?.Id;
    } catch (_) {
      // fallback
    }

    if (!userId) {
      const users = await fetchWithRetry(`${base}/Users`, authHeaders);
      const userList = Array.isArray(users) ? users : (users?.Items || []);
      if (!userList.length) return Response.json({ error: 'Could not authenticate with Emby. Check API key.' }, { status: 401 });
      const embyUser = userList.find(u => u.Policy?.IsAdministrator) || userList[0];
      userId = embyUser.Id;
    }

    // Count total items first
    const countJson = await fetchWithRetry(
      `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&Limit=1`,
      authHeaders
    );
    const totalCount = countJson.TotalRecordCount || 0;

    // Get existing media to deduplicate
    const existing = await base44.asServiceRole.entities.Media.list('-created_date', 5000);
    const existingMap = new Map(existing.map(m => [m.title.toLowerCase().trim(), m]));

    let startIndex = 0;
    let newItems = [];
    let updatedCount = 0;
    let fetchedCount = 0;

    while (startIndex < totalCount || (startIndex === 0 && totalCount === 0)) {
      const url = `${base}/Users/${userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true` +
        `&Fields=Overview,Genres,People,Studios,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags` +
        `&Limit=${PAGE_SIZE}&StartIndex=${startIndex}`;

      const json = await fetchWithRetry(url, authHeaders);
      const items = json.Items || [];
      if (!items.length) break;

      fetchedCount += items.length;

      for (const item of items) {
        const mapped = mapItem(item, base, token);
        const key = mapped.title.toLowerCase().trim();
        const existingItem = existingMap.get(key);
        if (existingItem) {
          if (mapped.video_url && !existingItem.video_url) {
            await base44.asServiceRole.entities.Media.update(existingItem.id, { video_url: mapped.video_url });
            updatedCount++;
          }
        } else {
          newItems.push(mapped);
          existingMap.set(key, { title: mapped.title }); // prevent duplicates within this batch
        }
      }

      startIndex += items.length;
      if (items.length < PAGE_SIZE) break;

      // Flush new items to DB in batches as we go to avoid memory buildup
      if (newItems.length >= BATCH_WRITE * 5) {
        for (let i = 0; i < newItems.length; i += BATCH_WRITE) {
          await base44.asServiceRole.entities.Media.bulkCreate(newItems.slice(i, i + BATCH_WRITE));
        }
        newItems = [];
      }
    }

    // Flush remaining
    let createdCount = 0;
    for (let i = 0; i < newItems.length; i += BATCH_WRITE) {
      await base44.asServiceRole.entities.Media.bulkCreate(newItems.slice(i, i + BATCH_WRITE));
      createdCount += Math.min(BATCH_WRITE, newItems.length - i);
    }

    return Response.json({
      success: true,
      fetched: fetchedCount,
      created: createdCount,
      updated: updatedCount,
      total: totalCount,
    });
  } catch (error) {
    const msg = error.message || String(error);
    // Surface helpful hints for common failures
    const isNetworkErr = /dns|connect|ECONNREFUSED|unreachable|network/i.test(msg);
    const hint = isNetworkErr
      ? ' (Is your Emby server on a local/private IP? The sync backend cannot reach local network addresses.)'
      : '';
    return Response.json({ error: msg + hint }, { status: 500 });
  }
});