import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Audio proxy — streams Emby audio through the server to bypass CORS/network restrictions.
 * POST { url: "https://emby-server/Audio/..." }
 * Returns the audio stream with appropriate headers.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { url } = body;
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamVault/1.0)',
        'Accept': 'audio/*,*/*',
      },
    });

    if (!upstream.ok) {
      return Response.json({ error: `Upstream error: ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstream.headers.get('content-length');

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});