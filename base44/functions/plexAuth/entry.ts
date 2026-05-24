import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { username, password, serverUrl } = await req.json();
    if (!username || !password) {
      return Response.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Step 1: Authenticate with Plex.tv to get the auth token
    const plexHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Plex-Client-Identifier': 'streamvault-app',
      'X-Plex-Product': 'StreamVault',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Device': 'Browser',
      'Accept': 'application/json',
    };

    const body = new URLSearchParams({ login: username, password });

    const authRes = await fetch('https://plex.tv/api/v2/users/signin', {
      method: 'POST',
      headers: plexHeaders,
      body: body.toString(),
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
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

    // Step 2: If a server URL was provided, verify connectivity
    if (serverUrl) {
      const base = serverUrl.replace(/\/$/, '');
      try {
        const pingRes = await fetch(`${base}/?X-Plex-Token=${plexToken}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!pingRes.ok) {
          return Response.json({
            error: `Connected to Plex.tv but could not reach your server at ${base}. Check the URL and port.`,
          }, { status: 400 });
        }
      } catch {
        return Response.json({
          error: `Got Plex token but cannot reach server at ${base}. Check the URL and ensure the server is online.`,
        }, { status: 400 });
      }
    }

    return Response.json({
      ok: true,
      plexToken,
      username: authData.username || authData.email || username,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});