import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertSafeUrl } from './ssrfGuard.ts';

/**
 * Video stream proxy — fetches a URL server-side and returns the content,
 * bypassing browser CORS restrictions for IPTV/HLS streams.
 * Usage: POST { url: "http://..." }
 * Returns: { content: string, contentType: string } for playlists
 *          or raw binary for segments
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const { url } = body;
    if (!url) return new Response('Missing url', { status: 400 });

    // Block SSRF — reject non-http(s) and private/internal addresses
    try { await assertSafeUrl(url); } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamVault/1.0)',
        'Accept': '*/*',
      },
    });

    if (!upstream.ok) {
      return Response.json({ error: `Upstream error: ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const isPlaylist = contentType.includes('mpegurl') || url.includes('.m3u8');

    if (isPlaylist) {
      const text = await upstream.text();
      return Response.json({ content: text, contentType: 'application/vnd.apple.mpegurl', originalUrl: url });
    }

    // Binary passthrough for TS segments
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});