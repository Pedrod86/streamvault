/**
 * Xtream Codes API — mapped endpoints
 *
 * All functions take a `server` object: { server_url, username, password }
 * Calls are proxied through the backend to avoid CORS issues.
 */

import { base44 } from '@/api/base44Client';

// Direct browser fetch to the Xtream API — used as a fallback when the backend
// proxy is blocked by the provider's IP filtering. On the user's own residential
// IP this frequently succeeds where the shared cloud IP is refused.
async function xtreamGetDirect(server, action, extra = '') {
  const base = xtreamBase(server);
  const u = encodeURIComponent(server.username || '');
  const p = encodeURIComponent(server.password || '');
  let url = `${base}/player_api.php?username=${u}&password=${p}`;
  if (action) url += `&action=${encodeURIComponent(action)}`;
  if (extra) url += `&${extra}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
  return await res.json();
}

async function xtreamGet(server, action, extra = '') {
  // Credentials are looked up server-side from the user's own MediaServer record —
  // we only pass the server id so secrets never travel in the request body.
  try {
    const res = await base44.functions.invoke('xtreamProxy', {
      serverId: server.id,
      action,
      extra,
    });
    const data = res?.data?.data;
    return data ?? null;
  } catch (proxyErr) {
    // Backend proxy blocked (e.g. 502 from provider IP block) — try directly from
    // the browser, which uses the user's own IP.
    try {
      return await xtreamGetDirect(server, action, extra);
    } catch (_) {
      throw proxyErr;
    }
  }
}

export function xtreamBase(server) {
  return server.server_url.replace(/\/$/, '');
}

// ─── 1. USERS ────────────────────────────────────────────────────────────────
export async function getXtreamUserInfo(server) {
  return xtreamGet(server, '');
}

// ─── 2. STREAMS ──────────────────────────────────────────────────────────────
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
export async function getLiveCategories(server) {
  return xtreamGet(server, 'get_live_categories');
}

export async function getVodCategories(server) {
  return xtreamGet(server, 'get_vod_categories');
}

export async function getSeriesCategories(server) {
  return xtreamGet(server, 'get_series_categories');
}

// ─── 4. EPG ──────────────────────────────────────────────────────────────────
export async function getEpgForStream(server, streamId, limit = 4) {
  return xtreamGet(server, 'get_short_epg', `stream_id=${streamId}&limit=${limit}`);
}

export async function getFullEpgForStream(server, streamId) {
  return xtreamGet(server, 'get_simple_data_table', `stream_id=${streamId}`);
}

export function getXmltvUrl(server) {
  const base = xtreamBase(server);
  const u = encodeURIComponent(server.username || '');
  const p = encodeURIComponent(server.password || '');
  return `${base}/xmltv.php?username=${u}&password=${p}`;
}

// ─── 5. CONNECTION INFO ───────────────────────────────────────────────────────
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

export async function getResellerInfo(server) {
  return xtreamGet(server, 'get_reseller_info');
}

export async function getPackages(server) {
  return xtreamGet(server, 'get_bouquets');
}

export async function getVodInfo(server, vodId) {
  return xtreamGet(server, 'get_vod_info', `vod_id=${vodId}`);
}

export async function getSeriesInfo(server, seriesId) {
  return xtreamGet(server, 'get_series_info', `series_id=${seriesId}`);
}