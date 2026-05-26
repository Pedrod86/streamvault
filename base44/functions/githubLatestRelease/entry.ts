import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch('https://api.github.com/repos/Pedrod86/streamvault/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'StreamVault-App',
        Authorization: `Bearer ${Deno.env.get('GITHUB_TOKEN')}`,
      },
    });

    if (!res.ok) {
      return Response.json({ error: `GitHub returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const apkAsset = (data.assets || []).find(a =>
      a.name.toLowerCase().endsWith('.apk')
    );

    return Response.json({
      tag: data.tag_name || null,
      name: data.name || null,
      published_at: data.published_at || null,
      body: data.body || null,
      html_url: data.html_url || null,
      apk: apkAsset ? {
        name: apkAsset.name,
        download_url: apkAsset.browser_download_url,
        size_mb: (apkAsset.size / 1024 / 1024).toFixed(1),
      } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});