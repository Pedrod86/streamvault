import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertSafeUrl } from './ssrfGuard.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url, method = 'GET', headers: reqHeaders = {}, bodyData } = body;

    if (!url) return Response.json({ error: 'Missing url parameter' }, { status: 400 });

    // Block SSRF — reject non-http(s) and private/internal addresses
    let parsedUrl;
    try { parsedUrl = assertSafeUrl(url); } catch (e) {
      return Response.json({ status: 0, ok: false, error: e.message, data: null }, { status: 400 });
    }

    // Headers that trick Cloudflare into thinking the request arrived over HTTPS
    // on the correct host, preventing it from issuing a 301 HTTP→HTTPS redirect.
    const cfBypassHeaders = parsedUrl ? {
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': parsedUrl.host,
      'X-Forwarded-For': '1.1.1.1',
      'CF-Visitor': '{"scheme":"https"}',
    } : {};

    const baseHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; StreamVault/1.0)',
      ...cfBypassHeaders,
      ...reqHeaders,
    };

    const fetchOptions = {
      method,
      headers: { ...baseHeaders },
    };
    if (bodyData) {
      fetchOptions.body = JSON.stringify(bodyData);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const redirectChain = [url];
    let currentUrl = url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      // Follow up to 5 redirects manually so we can detect and break loops
      for (let i = 0; i < 5; i++) {
        res = await fetch(currentUrl, { ...fetchOptions, signal: controller.signal, redirect: 'manual' });

        const isRedirect = res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308;
        if (!isRedirect) break;

        const location = res.headers.get('location');
        if (!location) break;

        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();

        // Re-validate every redirect hop to prevent redirect-based SSRF
        try { assertSafeUrl(nextUrl); } catch {
          console.log(`[mediaProxy] Blocked unsafe redirect to ${nextUrl}`);
          break;
        }

        // Break out of loops — if we've already seen this URL, stop
        if (redirectChain.includes(nextUrl)) {
          console.log(`[mediaProxy] Loop detected at ${nextUrl}, stopping`);
          break;
        }

        console.log(`[mediaProxy] Redirect ${i + 1}: ${currentUrl} → ${nextUrl}`);
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;

        // Update CF bypass headers for the new host
        let nextParsed;
        try { nextParsed = new URL(nextUrl); } catch { nextParsed = null; }
        if (nextParsed) {
          fetchOptions.headers['X-Forwarded-Host'] = nextParsed.host;
          fetchOptions.headers['X-Forwarded-Proto'] = 'https';
          fetchOptions.headers['CF-Visitor'] = '{"scheme":"https"}';
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return Response.json({
      status: res.status,
      ok: res.ok,
      data,
      redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
    });
  } catch (error) {
    const msg = error.name === 'AbortError'
      ? 'Request timed out — server unreachable or too slow'
      : error.message;
    return Response.json({ status: 0, ok: false, error: msg, data: null });
  }
});