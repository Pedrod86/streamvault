// Shared Emby auth helper.
//
// Resolving the Emby user id normally means hitting /Users?api_key=... which
// enumerates every account on the server — an expensive call. Several home-page
// widgets fire at once and the sync loop repeats per page, so doing this on
// every request floods Emby and can knock it offline.
//
// To avoid that, we cache the resolved userId on the MediaServer record
// (emby_user_id) and reuse it. The heavy /Users call then happens at most once
// per server instead of on every single request.

async function doFetch(url: string, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
    if (token) headers['X-Emby-Token'] = token;
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Resolve the Emby user id, using the value cached on the server record when
// present. On a cache miss it does the lookup once and persists it back so all
// future calls (and other functions) reuse it — no repeated /Users hammering.
export async function resolveEmbyUserId(base44: any, server: any, base: string, token: string): Promise<string> {
  // 1. Use the cached id if we have one.
  if (server?.emby_user_id) return server.emby_user_id;

  // 2. Cheap lookup first — /Users/Me only returns the current user.
  let userId: string | null = null;
  try {
    const me = await doFetch(`${base}/Users/Me?api_key=${token}`, token);
    if (me?.Id) userId = me.Id;
  } catch (_) { /* fall through */ }

  // 3. Fall back to the heavier enumeration only when necessary.
  if (!userId) {
    const users = await doFetch(`${base}/Users?api_key=${token}`, token);
    const list = Array.isArray(users) ? users : (users?.Items || []);
    const admin = list.find((u: any) => u.Policy?.IsAdministrator) || list[0];
    userId = admin?.Id || null;
  }

  if (!userId) throw new Error('Could not authenticate with Emby.');

  // 4. Persist for next time so we never repeat this on this server.
  if (server?.id) {
    try {
      await base44.asServiceRole.entities.MediaServer.update(server.id, { emby_user_id: userId });
    } catch (_) { /* non-fatal — caching is best-effort */ }
  }

  return userId;
}