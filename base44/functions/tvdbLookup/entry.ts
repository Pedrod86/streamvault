import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TVDB_BASE = 'https://api4.thetvdb.com/v4';
let cachedToken = null;
let tokenExpiry = 0;

async function getTvdbToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${TVDB_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: Deno.env.get('TVDB_API_KEY') }),
  });
  const data = await res.json();
  if (!data.data?.token) throw new Error('TVDB auth failed: ' + JSON.stringify(data));
  cachedToken = data.data.token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
  return cachedToken;
}

async function tvdbFetch(path, token) {
  const res = await fetch(`${TVDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`TVDB ${path} returned ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, year, type } = await req.json();
    if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

    const token = await getTvdbToken();

    // Search for the title
    const searchParams = new URLSearchParams({ query: title });
    if (type === 'movie') searchParams.set('type', 'movie');
    else if (type === 'tv_show') searchParams.set('type', 'series');

    const searchData = await tvdbFetch(`/search?${searchParams}`, token);
    const results = searchData.data || [];

    if (!results.length) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Pick best match — prefer year match if provided
    let match = results[0];
    if (year) {
      const yearMatch = results.find(r => {
        const y = r.year || r.first_air_time?.slice(0, 4);
        return y && Math.abs(parseInt(y) - parseInt(year)) <= 1;
      });
      if (yearMatch) match = yearMatch;
    }

    const entityType = match.type; // 'series' or 'movie'
    const id = match.tvdb_id || match.id;

    // Fetch extended details
    let extended = null;
    try {
      if (entityType === 'movie') {
        const d = await tvdbFetch(`/movies/${id}/extended`, token);
        extended = d.data;
      } else {
        const d = await tvdbFetch(`/series/${id}/extended`, token);
        extended = d.data;
      }
    } catch (_) {}

    // Build artwork URLs
    const getImage = (artworks, type) => {
      const art = artworks?.find(a => a.type === type && a.language === 'eng') ||
                  artworks?.find(a => a.type === type);
      return art?.image || null;
    };

    const artworks = extended?.artworks || [];
    // type 2 = poster, type 3 = banner/backdrop
    const poster = getImage(artworks, 2) || match.image_url || match.thumbnail || null;
    const backdrop = getImage(artworks, 3) || null;

    const genres = extended?.genres?.map(g => g.name) ||
                   match.genres ||
                   (match.genre_ids ? [] : []);

    const overview = extended?.overview || match.overview || null;

    const seasonCount = entityType === 'series'
      ? (extended?.seasons?.filter(s => s.type?.type === 'official' && s.number > 0).length || null)
      : null;

    return Response.json({
      tvdbId: String(id),
      title: extended?.name || match.name || title,
      overview,
      poster,
      backdrop,
      genres,
      year: extended?.year || match.year || null,
      status: extended?.status?.name || null,
      seasonCount,
      rating: extended?.averageScore ? parseFloat(Number(extended.averageScore / 10).toFixed(1)) : null,
      contentRating: extended?.contentRatings?.[0]?.name || null,
      network: extended?.networks?.[0]?.name || extended?.studios?.[0]?.name || null,
      type: entityType === 'movie' ? 'movie' : 'tv_show',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});