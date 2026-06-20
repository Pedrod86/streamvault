/**
 * LAN-first / relay-fallback connection resolver for Emby servers.
 *
 * The backend proxy cannot reach private LAN IPs (192.168.x.x, 10.x, localhost),
 * but the app's WebView often CAN when it's on the same network. So we probe the
 * local_url directly from the client first; if that fails, we fall back to the
 * remote relay URL through the mediaProxy backend (which handles CORS / Cloudflare).
 *
 * The winning route is cached per server for the session so we don't re-probe on
 * every request — it's re-evaluated when the network reconnects.
 */
import { base44 } from '@/api/base44Client';

const strip = (u) => (u || '').replace(/\/$/, '');

// serverId -> { base, mode: 'local' | 'relay', at }
const routeCache = new Map();

const PROBE_TIMEOUT = 2500;

// Direct client-side probe of a LAN URL — only the WebView can reach these.
async function probeLocal(base, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(`${base}/System/Info/Public`, {
      signal: controller.signal,
      headers: token ? { 'X-Emby-Token': token } : {},
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the best base URL + fetch strategy for a server.
 * Returns { base, mode, fetchJson(path, headers) }.
 *
 * - mode 'local': direct client fetch (fast, LAN)
 * - mode 'relay': fetch via mediaProxy backend (remote)
 */
export async function resolveEmbyConnection(server, { force = false } = {}) {
  const token = server.api_token;
  const localBase = strip(server.local_url);
  const relayBase = strip(server.server_url);

  // Use cached route unless forced or stale (> 5 min)
  const cached = routeCache.get(server.id);
  if (!force && cached && Date.now() - cached.at < 5 * 60 * 1000) {
    return makeConnection(cached.base, cached.mode, token);
  }

  // LAN-first: only if a local URL is configured and we're online
  if (localBase && navigator.onLine && (await probeLocal(localBase, token))) {
    routeCache.set(server.id, { base: localBase, mode: 'local', at: Date.now() });
    return makeConnection(localBase, 'local', token);
  }

  // Relay fallback — go through the backend proxy
  routeCache.set(server.id, { base: relayBase, mode: 'relay', at: Date.now() });
  return makeConnection(relayBase, 'relay', token);
}

function makeConnection(base, mode, token) {
  const fetchJson = async (path, headers = {}) => {
    const url = path.startsWith('http') ? path : `${base}${path}`;
    if (mode === 'local') {
      const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
      if (!res.ok) throw new Error(`Emby returned HTTP ${res.status}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { return text; }
    }
    // relay → mediaProxy
    const res = await base44.functions.invoke('mediaProxy', { url, headers });
    if (res.data?.error) throw new Error(`Proxy error: ${res.data.error}`);
    if (!res.data?.ok) throw new Error(`Emby returned HTTP ${res.data?.status}`);
    return res.data.data;
  };

  return { base, mode, token, fetchJson };
}

// Clear cached routes so the next request re-probes LAN-first.
// Call this on network reconnect (e.g. moving between Wi-Fi and cellular).
export function clearConnectionRoutes() {
  routeCache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', clearConnectionRoutes);
}