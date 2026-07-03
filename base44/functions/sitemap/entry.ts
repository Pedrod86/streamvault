Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Derive the app's public origin from the incoming request.
    const origin = `${url.protocol}//${url.host}`;

    // Public, crawlable routes only (auth-gated app pages are excluded).
    const paths = [
      '/',
      '/login',
      '/register',
      '/about',
      '/contact',
    ];

    const today = new Date().toISOString().split('T')[0];

    const urlEntries = paths.map((p) => {
      const loc = `${origin}${p === '/' ? '' : p}`;
      const priority = p === '/' ? '1.0' : '0.6';
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${error.message}</error>`, {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
});