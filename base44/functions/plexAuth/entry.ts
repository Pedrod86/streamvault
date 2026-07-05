import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { username, password, serverUrl } = await req.json();
    if (!username || !password) {
      return Response.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const plexHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Plex-Client-Identifier': 'streamvault-app',
      'X-Plex-Product': 'StreamVault',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Device': 'Browser',
      'Accept': 'application/json',
    };

    // Step 1: Authenticate with Plex.tv to get the auth token
    const body = new URLSearchParams({ login: username, password });
    const authRes = await fetch('https://plex.tv/api/v2/users/signin', {
      method: 'POST',
      headers: plexHeaders,
      body: body.toString(),
    });

    if (!authRes.ok) {
      if (authRes.status === 401) {
        return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
      }
      return Response.json({ error: `Plex authentication failed: ${authRes.status}` }, { status: 400 });
    }

    const authData = await authRes.json();
    const plexToken = authData.authToken || authData.authentication_token;
    if (!plexToken) {
      return Response.json({ error: 'Could not retrieve Plex token from response.' }, { status: 400 });
    }

    // Step 2a: If the user explicitly provided a server URL, verify it and use it.
    if (serverUrl) {
      const base = serverUrl.replace(/\/$/, '');
      if (/app\.plex\.tv|plex\.tv\/web|plex\.tv\/desktop/i.test(base)) {
        return Response.json({
          error: 'That URL is the Plex web app, not your media server. Leave it blank to auto-discover, or enter your server address (e.g. http://192.168.1.100:32400).',
        }, { status: 400 });
      }
      try {
        const pingRes = await fetch(`${base}/?X-Plex-Token=${plexToken}`, { signal: AbortSignal.timeout(8000) });
        if (!pingRes.ok) {
          return Response.json({ error: `Could not reach your server at ${base}. Check the URL and port (Plex default is 32400).` }, { status: 400 });
        }
      } catch {
        return Response.json({ error: `Cannot reach server at ${base}. Make sure it's online and the URL includes the port.` }, { status: 400 });
      }
      return Response.json({ ok: true, plexToken, username: authData.username || authData.email || username, serverUrl: base });
    }

    // Step 2b: No URL provided — auto-discover the user's servers from Plex.tv.
    const resRes = await fetch('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', {
      headers: { ...plexHeaders, 'X-Plex-Token': plexToken },
    });
    if (!resRes.ok) {
      return Response.json({ error: `Signed in, but could not list your Plex servers (${resRes.status}). You can enter a server URL manually.` }, { status: 400 });
    }
    const resources = await resRes.json();
    const servers = (Array.isArray(resources) ? resources : []).filter((r) => r.provides?.includes('server'));

    if (!servers.length) {
      return Response.json({ error: 'No Plex servers found on your account. Make sure your server is online and signed in.' }, { status: 400 });
    }

    // Pick the first reachable connection across all discovered servers.
    let chosen = null;
    for (const srv of servers) {
      const conns = (srv.connections || []).slice().sort((a, b) => (a.local === b.local ? 0 : a.local ? 1 : -1));
      for (const conn of conns) {
        try {
          const ping = await fetch(`${conn.uri}/?X-Plex-Token=${srv.accessToken || plexToken}`, { signal: AbortSignal.timeout(6000) });
          if (ping.ok) {
            chosen = { url: conn.uri, name: srv.name, accessToken: srv.accessToken || plexToken };
            break;
          }
        } catch { /* try next connection */ }
      }
      if (chosen) break;
    }

    if (!chosen) {
      return Response.json({ error: 'Found your Plex account but none of your servers were reachable right now. Try again, or enter a server URL manually.' }, { status: 400 });
    }

    return Response.json({
      ok: true,
      plexToken: chosen.accessToken,
      username: authData.username || authData.email || username,
      serverUrl: chosen.url,
      serverName: chosen.name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});