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
      // First attempt: let fetch follow redirects automatically (handles HTTP→HTTPS via Cloudflare)
      res = await fetch(currentUrl, { ...fetchOptions, signal: controller.signal, redirect: 'follow' });
      // If the response URL changed, record it in the chain
      if (res.url && res.url !== currentUrl) {
        redirectChain.push(res.url);
        console.log(`[mediaProxy] Redirect chain: ${currentUrl} → ${res.url} (status: ${res.status})`);
        currentUrl = res.url;
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