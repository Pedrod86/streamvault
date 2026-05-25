import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let serverCache = null;
let serverCacheTime = 0;
const SERVER_TTL = 5 * 60 * 1000;

async function getServer(base44) {
  if (serverCache && Date.now() - serverCacheTime < SERVER_TTL) return serverCache;
  const servers = await base44.entities.MediaServer.filter({ server_type: 'emby' }, '-created_date', 1);
  const s = servers?.find(s => s.is_active !== false) || servers?.[0] || null;
  serverCache = s;
  serverCacheTime = Date.now();
  return s;
}

async function doFetch(url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { 'X-Emby-Token': token, 'Accept': 'application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function resolveUserId(base, token) {
  const res = await doFetch(`${base}/Users?api_key=${token}`, token);
  if (!res.ok) return null;
  const users = await res.json();
  const admin = users.find(u => u.Policy?.IsAdministrator) || users[0];
  return admin?.Id || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const server = await getServer(base44);
    if (!server) return Response.json({ error: 'No Emby server configured' }, { status: 404 });

    const base = server.server_url?.replace(/\/$/, '');
    const token = server.api_token;
    if (!base || !token) return Response.json({ error: 'Server missing URL or token' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { action, itemId, startIndex = 0, pageSize = 100 } = body;

    const userId = await resolveUserId(base, token);
    if (!userId) return Response.json({ error: 'Could not resolve Emby user' }, { status: 500 });

    // Fetch chapters for a specific audiobook
    if (action === 'chapters' && itemId) {
      const res = await doFetch(`${base}/Items/${itemId}?api_key=${token}&Fields=Chapters,Overview,People,MediaStreams`, token);
      if (!res.ok) return Response.json({ error: 'Failed to fetch item details' }, { status: res.status });
      const data = await res.json();
      const chapters = (data.Chapters || []).map((c, i) => ({
        index: i,
        name: c.ChapterName || `Chapter ${i + 1}`,
        startPositionTicks: c.StartPositionTicks || 0,
        startSeconds: Math.floor((c.StartPositionTicks || 0) / 10_000_000),
      }));
      return Response.json({ chapters, overview: data.Overview || '' });
    }

    // Fetch audiobook library
    const params = new URLSearchParams({
      IncludeItemTypes: 'AudioBook,Audio,Book',
      Recursive: 'true',
      Fields: 'Overview,Genres,People,ProviderIds,RunTimeTicks,ImageTags,BackdropImageTags',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      StartIndex: String(startIndex),
      Limit: String(pageSize),
      api_key: token,
    });

    const res = await doFetch(`${base}/Users/${userId}/Items?${params}`, token);
    if (!res.ok) return Response.json({ error: `Emby returned ${res.status}` }, { status: res.status });
    const data = await res.json();

    const items = (data.Items || []).map(item => {
      const hasPrimary = item.ImageTags?.Primary;
      const posterUrl = hasPrimary
        ? `${base}/Items/${item.Id}/Images/Primary?api_key=${token}&maxHeight=400`
        : null;
      const streamUrl = `${base}/Audio/${item.Id}/universal?api_key=${token}&audioCodec=mp3&maxAudioBitDepth=16&audioBitRate=192000&TranscodingContainer=mp3&TranscodingProtocol=http`;
      const durationSeconds = item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10_000_000) : 0;

      return {
        id: item.Id,
        title: item.Name || 'Unknown',
        author: item.AlbumArtist || item.Artists?.[0] || item.People?.find(p => p.Type === 'Author')?.Name || '',
        narrator: item.People?.find(p => p.Type === 'Narrator')?.Name || '',
        overview: item.Overview || '',
        genres: item.Genres || [],
        year: item.ProductionYear || null,
        posterUrl,
        streamUrl,
        durationSeconds,
        type: item.Type,
      };
    });

    return Response.json({
      items,
      totalCount: data.TotalRecordCount || items.length,
      hasMore: startIndex + items.length < (data.TotalRecordCount || 0),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});