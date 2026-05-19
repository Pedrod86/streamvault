/**
 * Xtream Codes API — mapped endpoints
 *
 * All functions take a `server` object: { server_url, username, password }
 * server_url should already be normalised (http://host:port or http://host:port/api)
 */

function xtreamBase(server) {
  return server.server_url.replace(/\/$/, '');
}

function xtreamAuth(server) {
  const u = encodeURIComponent(server.username || '');
  const p = encodeURIComponent(server.password || '');
  return `username=${u}&password=${p}`;
}

async function xtreamGet(server, action, extra = '') {
  const base = xtreamBase(server);
  const auth = xtreamAuth(server);
  const actionPart = action ? `&action=${action}` : '';
  const url = `${base}/player_api.php?${auth}${actionPart}${extra ? '&' + extra : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Xtream API error (${res.status})`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

// ─── 1. USERS ────────────────────────────────────────────────────────────────
// GET /player_api.php?username=&password=  (no action → returns user_info + server_info)
export async function getXtreamUserInfo(server) {
  return xtreamGet(server, '');
}

// ─── 2. STREAMS ──────────────────────────────────────────────────────────────
// Live streams:  action=get_live_streams
// VOD streams:   action=get_vod_streams
// Series:        action=get_series
export async function getLiveStreams(server, categoryId) {
  const extra = categoryId ? `category_id=${categoryId}` : '';
  return xtreamGet(server, 'get_live_streams', extra);
}

export async function getVodStreams(server, categoryId) {
  const extra = categoryId ? `category_id=${categoryId}` : '';
  return xtreamGet(server, 'get_vod_streams', extra);
}

export async function getSeriesStreams(server, categoryId) {
  const extra = categoryId ? `category_id=${categoryId}` : '';
  return xtreamGet(server, 'get_series', extra);
}

// Stream URL builders (no API call needed)
export function getLiveStreamUrl(server, streamId, ext = 'ts') {
  const base = xtreamBase(server);
  const { username, password } = server;
  return `${base}/live/${username}/${password}/${streamId}.${ext}`;
}

export function getVodStreamUrl(server, streamId, ext = 'mp4') {
  const base = xtreamBase(server);
  const { username, password } = server;
  return `${base}/movie/${username}/${password}/${streamId}.${ext}`;
}

// ─── 3. CATEGORIES ───────────────────────────────────────────────────────────
// action=get_live_categories / get_vod_categories / get_series_categories
export async function getLiveCategories(server) {
  return xtreamGet(server, 'get_live_categories');
}

export async function getVodCategories(server) {
  return xtreamGet(server, 'get_vod_categories');
}

export async function getSeriesCategories(server) {
  return xtreamGet(server, 'get_series_categories');
}

// ─── 4. EPG (Electronic Programme Guide) ─────────────────────────────────────
// All EPG:         GET /xmltv.php?username=&password=
// EPG by stream:   action=get_simple_data_table&stream_id=X
// Short EPG:       action=get_short_epg&stream_id=X&limit=N
export async function getEpgForStream(server, streamId, limit = 4) {
  return xtreamGet(server, 'get_short_epg', `stream_id=${streamId}&limit=${limit}`);
}

export async function getFullEpgForStream(server, streamId) {
  return xtreamGet(server, 'get_simple_data_table', `stream_id=${streamId}`);
}

export function getXmltvUrl(server) {
  const base = xtreamBase(server);
  const auth = xtreamAuth(server);
  return `${base}/xmltv.php?${auth}`;
}

// ─── 5. CONNECTIONS ──────────────────────────────────────────────────────────
// Server info + active connection count is returned in the auth response
export async function getConnectionInfo(server) {
  const data = await getXtreamUserInfo(server);
  return {
    user_info: data?.user_info || {},
    server_info: data?.server_info || {},
    active_cons: data?.user_info?.active_cons,
    max_connections: data?.user_info?.max_connections,
    exp_date: data?.user_info?.exp_date,
    status: data?.user_info?.status,
  };
}

// ─── 6. RESELLERS ─────────────────────────────────────────────────────────────
// Xtream reseller panel endpoints (requires reseller/admin credentials)
// action=get_reseller_info
export async function getResellerInfo(server) {
  return xtreamGet(server, 'get_reseller_info');
}

// ─── 7. PACKAGES ──────────────────────────────────────────────────────────────
// Bouquets (channel packages): action=get_bouquets
export async function getPackages(server) {
  return xtreamGet(server, 'get_bouquets');
}

// ─── VOD INFO / SERIES DETAILS ────────────────────────────────────────────────
export async function getVodInfo(server, vodId) {
  return xtreamGet(server, 'get_vod_info', `vod_id=${vodId}`);
}

export async function getSeriesInfo(server, seriesId) {
  return xtreamGet(server, 'get_series_info', `series_id=${seriesId}`);
}