import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scheduled function: posts a Discord message when a new episode of a show on the
// user's Watchlist is added to the Emby library. De-dupes via NotifiedEpisode records.

let _serverCache = null;
let _serverCacheAt = 0;
const SERVER_CACHE_TTL = 5 * 60 * 1000;

async function getEmbyServer(base44) {
  const now = Date.now();
  if (_serverCache && (now - _serverCacheAt) < SERVER_CACHE_TTL) return _serverCache;
  const servers = await base44.asServiceRole.entities.MediaServer.list();
  const server = servers.find(s => s.server_type === 'emby' && s.is_active !== false) || null;
  _serverCache = server;
  _serverCacheAt = now;
  return server;
}

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
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

const norm = (s) => (s || '').toLowerCase().trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) return Response.json({ ok: true, reason: 'no webhook configured' });

    const server = await getEmbyServer(base44);
    if (!server) return Response.json({ ok: true, reason: 'no emby server' });

    // Resolve the set of show titles on the user's watchlist
    const [watchlist, allMedia] = await Promise.all([
      base44.asServiceRole.entities.Watchlist.list('-created_date', 500),
      base44.asServiceRole.entities.Media.list('-created_date', 2000),
    ]);
    const mediaById = new Map(allMedia.map(m => [m.id, m]));
    const watchlistTitles = new Set();
    watchlist.forEach(w => {
      const m = mediaById.get(w.media_id);
      if (m && m.media_type === 'tv_show') watchlistTitles.add(norm(m.title));
    });

    if (watchlistTitles.size === 0) {
      return Response.json({ ok: true, reason: 'no tv shows on watchlist' });
    }

    const base = server.server_url.replace(/\/$/, '');
    const token = server.api_token;
    const userId = await resolveUserId(base, token);

    // Latest episodes added to Emby
    const json = await doFetch(
      `${base}/Users/${userId}/Items/Latest` +
      `?IncludeItemTypes=Episode` +
      `&Fields=Overview,SeriesName,ParentIndexNumber,IndexNumber,ImageTags,SeriesId` +
      `&Limit=30&api_key=${token}`
    );
    const rawItems = Array.isArray(json) ? json : (json?.Items || []);

    // Episodes belonging to a watchlisted show
    const matched = rawItems.filter(it => watchlistTitles.has(norm(it.SeriesName)));
    if (matched.length === 0) return Response.json({ ok: true, notified: 0 });

    // De-dupe against episodes we've already announced
    const alreadyNotified = await base44.asServiceRole.entities.NotifiedEpisode.list('-created_date', 1000);
    const notifiedIds = new Set(alreadyNotified.map(n => n.emby_item_id));

    let sent = 0;
    for (const ep of matched) {
      if (notifiedIds.has(ep.Id)) continue;

      const seLabel = ep.ParentIndexNumber && ep.IndexNumber
        ? `S${String(ep.ParentIndexNumber).padStart(2, '0')}E${String(ep.IndexNumber).padStart(2, '0')}`
        : '';
      const embed = {
        title: `📺 New Episode: ${ep.SeriesName}`,
        description: `**${seLabel}${seLabel ? ' – ' : ''}${ep.Name || 'New episode'}**`,
        color: 0x57F287,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: { text: 'StreamVault · Watchlist' },
      };
      if (ep.Overview) {
        embed.fields.push({ name: 'Overview', value: ep.Overview.slice(0, 200) + (ep.Overview.length > 200 ? '…' : ''), inline: false });
      }
      if (ep.SeriesId) embed.thumbnail = { url: buildImageUrl(base, ep.SeriesId, token, 'Primary') };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      await base44.asServiceRole.entities.NotifiedEpisode.create({
        emby_item_id: ep.Id,
        series_name: ep.SeriesName,
        episode_label: seLabel,
      });
      sent += 1;
    }

    return Response.json({ ok: true, notified: sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});