import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Resolves a Plex movie ratingKey to a direct-play stream URL.
 * Usage: POST { ratingKey: "12345" }
 * Returns: { streamUrl, title }
 */

async function doFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ratingKey } = await req.json();
    if (!ratingKey) return Response.json({ error: 'Missing ratingKey' }, { status: 400 });

    const servers = await base44.entities.MediaServer.list();
    const server = servers.find(s => s.server_type === 'plex' && s.is_active !== false);
    if (!server) return Response.json({ error: 'No Plex server connected' }, { status: 404 });

    const base = (server.server_url || '').replace(/\/web\/?$/, '').replace(/\/$/, '');
    const token = server.plex_token || server.api_token;
    if (!base || !token) return Response.json({ error: 'Plex server misconfigured' }, { status: 400 });

    const meta = await doFetch(`${base}/library/metadata/${ratingKey}?X-Plex-Token=${token}`);
    const item = meta?.MediaContainer?.Metadata?.[0];
    if (!item) return Response.json({ error: 'Item not found on Plex' }, { status: 404 });

    const part = item.Media?.[0]?.Part?.[0];
    if (!part?.key) return Response.json({ error: 'No playable file for this title' }, { status: 404 });

    const streamUrl = `${base}${part.key}?X-Plex-Token=${token}`;

    return Response.json({ streamUrl, title: item.title });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});