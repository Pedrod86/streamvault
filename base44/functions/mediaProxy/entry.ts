import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url, method = 'GET', headers: reqHeaders = {}, bodyData } = body;

    if (!url) return Response.json({ error: 'Missing url parameter' }, { status: 400 });

    const fetchOptions = {
      method,
      headers: { 'Accept': 'application/json', ...reqHeaders },
    };
    if (bodyData) {
      fetchOptions.body = JSON.stringify(bodyData);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const redirectChain = [url];
    let currentUrl = url;
    let res;
    try {
      res = await fetch(currentUrl, { ...fetchOptions, signal: controller.signal, redirect: 'manual' });
      // Follow redirects manually (up to 10 hops) to avoid Deno's redirect limit errors
      let redirectCount = 0;
      while ((res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) && redirectCount < 10) {
        const location = res.headers.get('location');
        if (!location) break;
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
        console.log(`[mediaProxy] Redirect ${redirectCount + 1}: ${res.status} ${currentUrl} → ${nextUrl}`);
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        res = await fetch(currentUrl, { ...fetchOptions, signal: controller.signal, redirect: 'manual' });
        redirectCount++;
      }
      if (redirectChain.length > 1) {
        console.log(`[mediaProxy] Redirect chain (${redirectChain.length - 1} hops): ${redirectChain.join(' → ')}`);
        console.log(`[mediaProxy] Final URL: ${currentUrl} — status: ${res.status}`);
      }
      if (redirectCount >= 10) {
        console.error(`[mediaProxy] Hit redirect limit (10). Chain so far:\n${redirectChain.map((u, i) => `  ${i}: ${u}`).join('\n')}`);
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

    return Response.json({ status: res.status, ok: res.ok, data, redirectChain: redirectChain.length > 1 ? redirectChain : undefined });
  } catch (error) {
    const msg = error.name === 'AbortError'
      ? 'Request timed out — server unreachable or too slow'
      : error.message;
    return Response.json({ status: 0, ok: false, error: msg, data: null });
  }
});