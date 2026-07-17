import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { server_url, username, password, action, extra } = await req.json();
    if (!server_url || !username || !password) {
      return Response.json({ error: 'Missing server credentials' }, { status: 400 });
    }

    const base = server_url.replace(/\/$/, '');
    const u = encodeURIComponent(username);
    const p = encodeURIComponent(password);
    const actionPart = action ? `&action=${action}` : '';
    const extraPart = extra ? `&${extra}` : '';
    const url = `${base}/player_api.php?username=${u}&password=${p}${actionPart}${extraPart}`;

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