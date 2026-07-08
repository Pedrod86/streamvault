import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function getEmbyServer(base44, serverId) {
  const servers = await base44.entities.MediaServer.list();
  const embyServers = servers.filter(s => s.server_type === 'emby' && s.is_active !== false);
  if (serverId) return embyServers.find(s => s.id === serverId) || null;
  return embyServers[0] || null;
}

async function doFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
    if (token) headers['X-Emby-Token'] = token;
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const EMBY_AUTH_HEADER =
  'MediaBrowser Client="StreamVault", Device="Server", DeviceId="streamvault-backend", Version="1.0.0"';

async function authenticateByName(base, username, password) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': EMBY_AUTH_HEADER },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Auth HTTP ${res.status}`);
    const data = await res.json();
    return { token: data?.AccessToken || null, userId: data?.User?.Id || null };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUserId(base, token) {
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`, token);
    if (me?.Id) return me.Id;
  } catch (_) {}
  const users = await doFetch(`${base}/Users?api_key=${token}`, token);
  const list = Array.isArray(users) ? users : (users?.Items || []);
  const admin = list.find(u => u.Policy?.IsAdministrator) || list[0];
  if (admin?.Id) return admin.Id;
  throw new Error('Could not authenticate with Emby.');
}

async function resolveAuth(base, server) {
  const storedToken = server.api_token;
  if (storedToken) {
    try {
      const userId = await resolveUserId(base, storedToken);
      return { token: storedToken, userId };
    } catch (_) {}
  }
  if (server.username && server.password) {
    const { token, userId } = await authenticateByName(base, server.username, server.password);
    if (token) return { token, userId: userId || (await resolveUserId(base, token)) };
  }
  throw new Error('Could not authenticate with Emby.');
}

function formatSize(bytes) {
  if (!bytes) return null;
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const itemId = body.itemId;
    if (!itemId) return Response.json({ error: 'Missing itemId' }, { status: 400 });

    const server = await getEmbyServer(base44, body.serverId);
    if (!server) return Response.json({ error: 'No active Emby server found' }, { status: 404 });

    const base = server.server_url.replace(/\/$/, '');
    const { token, userId } = await resolveAuth(base, server);

    const item = await doFetch(
      `${base}/Users/${userId}/Items/${itemId}?api_key=${token}&Fields=MediaSources,MediaStreams,Path`,
      token
    );

    const source = (item?.MediaSources || [])[0] || {};
    const streams = source.MediaStreams || item?.MediaStreams || [];
    const video = streams.find(s => s.Type === 'Video') || null;
    const audio = streams.find(s => s.Type === 'Audio') || null;

    const mapVideo = video ? {
      title: video.DisplayTitle || null,
      codec: video.Codec || null,
      profile: video.Profile || null,
      level: video.Level || null,
      resolution: (video.Width && video.Height) ? `${video.Width}x${video.Height}` : null,
      aspectRatio: video.AspectRatio || null,
      interlaced: typeof video.IsInterlaced === 'boolean' ? (video.IsInterlaced ? 'Yes' : 'No') : null,
      frameRate: video.RealFrameRate ? Number(video.RealFrameRate).toFixed(3) : null,
      bitRate: video.BitRate ? `${Math.round(video.BitRate / 1000)} kbps` : null,
      videoRange: video.VideoRange || null,
      colorPrimaries: video.ColorPrimaries || null,
      colorSpace: video.ColorSpace || null,
      colorTransfer: video.ColorTransfer || null,
      bitDepth: video.BitDepth ? `${video.BitDepth} bit` : null,
      pixelFormat: video.PixelFormat || null,
      refFrames: typeof video.RefFrames === 'number' ? video.RefFrames : null,
    } : null;

    const mapAudio = audio ? {
      title: audio.DisplayTitle || null,
      language: audio.Language || null,
      codec: audio.Codec || null,
      channelLayout: audio.ChannelLayout || null,
      channels: typeof audio.Channels === 'number' ? audio.Channels : null,
      sampleRate: audio.SampleRate ? `${audio.SampleRate} Hz` : null,
      bitRate: audio.BitRate ? `${Math.round(audio.BitRate / 1000)} kbps` : null,
      default: typeof audio.IsDefault === 'boolean' ? (audio.IsDefault ? 'Yes' : 'No') : null,
    } : null;

    const runtimeMin = item?.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null;

    return Response.json({
      video: mapVideo,
      audio: mapAudio,
      file: {
        path: source.Path || item?.Path || null,
        size: formatSize(source.Size),
        container: source.Container ? source.Container.toUpperCase() : null,
        runtime: runtimeMin ? `${Math.floor(runtimeMin / 60)}h ${runtimeMin % 60}m` : null,
        summary: mapVideo?.title || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});