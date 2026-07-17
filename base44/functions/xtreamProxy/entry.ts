import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertSafeUrl } from './ssrfGuard.ts';

// Xtream Codes player_api.php actions we allow the client to request.
// Anything not on this list is rejected so the proxy can't be used to hit
// arbitrary endpoints on the upstream server.
const ALLOWED_ACTIONS = new Set([
  '', // user info (no action param)
  'get_live_streams',
  'get_vod_streams',
  'get_series',
  'get_live_categories',
  'get_vod_categories',
  'get_series_categories',
  'get_short_epg',
  'get_simple_data_table',
  'get_reseller_info',
  'get_bouquets',
  'get_vod_info',
  'get_series_info',
]);

// Query keys allowed in the `extra` param, mapped to their expected value type.
// Values are validated and re-encoded so the client can't inject arbitrary
// query string fragments (e.g. extra credentials or overriding username/password).
const ALLOWED_EXTRA_KEYS = new Set([
  'category_id',
  'stream_id',
  'limit',
  'vod_id',
  'series_id',
]);

// Parse a client-supplied `extra` string (e.g. "category_id=5&limit=4") into a
// safe, whitelisted query fragment. Rejects unknown keys and unsafe values.
function buildSafeExtra(extra: string): string {
  if (!extra) return '';
  const params = new URLSearchParams();
  for (const pair of extra.split('&')) {
    if (!pair) continue;
    const [rawKey, rawVal = ''] = pair.split('=');
    const key = rawKey.trim();
    if (!ALLOWED_EXTRA_KEYS.has(key)) {
      throw new Error(`Disallowed query parameter: ${key}`);
    }
    // Values are simple identifiers/numbers — strip anything else.
    const val = decodeURIComponent(rawVal).replace(/[^a-zA-Z0-9_-]/g, '');
    params.append(key, val);
  }
  const s = params.toString();
  return s ? `&${s}` : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { serverId, action, extra } = await req.json();
    if (!serverId) {
      return Response.json({ error: 'Missing serverId' }, { status: 400 });
    }

    // Look up the server credentials from the caller's own MediaServer record.
    // RLS scopes this to created_by_id === user, so a user can only proxy their
    // own servers — credentials are never accepted from the request body.
    const server = await base44.entities.MediaServer.get(serverId).catch(() => null);
    if (!server || server.server_type !== 'xtream') {
      return Response.json({ error: 'Server not found' }, { status: 404 });
    }
    if (!server.server_url || !server.username || !server.password) {
      return Response.json({ error: 'Server is missing credentials' }, { status: 400 });
    }

    // Validate the requested action against the whitelist.
    const act = action || '';
    if (!ALLOWED_ACTIONS.has(act)) {
      return Response.json({ error: `Disallowed action: ${act}` }, { status: 400 });
    }

    const base = server.server_url.replace(/\/$/, '');
    const u = encodeURIComponent(server.username);
    const p = encodeURIComponent(server.password);
    const actionPart = act ? `&action=${encodeURIComponent(act)}` : '';
    const extraPart = buildSafeExtra(extra || '');
    const url = `${base}/player_api.php?username=${u}&password=${p}${actionPart}${extraPart}`;

    // SSRF guard: block private/loopback/link-local/metadata destinations
    await assertSafeUrl(url);

    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ error: `Xtream API error (${res.status})` }, { status: 502 });
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});