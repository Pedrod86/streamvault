import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, year, type } = await req.json();
    if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

    // Accept either a bare key or a full OMDb URL that was pasted by mistake.
    const rawKey = Deno.env.get('OMDB_API_KEY') || '';
    const apiKey = rawKey.match(/apikey=([^&\s]+)/i)?.[1] || rawKey.trim();
    const params = new URLSearchParams({ apikey: apiKey, t: title, plot: 'full' });
    if (year) params.set('y', String(year));
    if (type) params.set('type', type === 'tv_show' ? 'series' : 'movie');

    const res = await fetch(`https://www.omdbapi.com/?${params}`);
    const data = await res.json();

    if (data.Response === 'False') {
      return Response.json({ error: data.Error || 'Not found' }, { status: 404 });
    }

    return Response.json({
      imdbId: data.imdbID,
      imdbRating: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
      imdbVotes: data.imdbVotes !== 'N/A' ? data.imdbVotes : null,
      rottenTomatoes: data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value || null,
      metascore: data.Metascore !== 'N/A' ? data.Metascore : null,
      plot: data.Plot !== 'N/A' ? data.Plot : null,
      director: data.Director !== 'N/A' ? data.Director : null,
      cast: data.Actors !== 'N/A' ? data.Actors.split(', ') : null,
      genre: data.Genre !== 'N/A' ? data.Genre.split(', ') : null,
      awards: data.Awards !== 'N/A' ? data.Awards : null,
      poster: data.Poster !== 'N/A' ? data.Poster : null,
      runtime: data.Runtime !== 'N/A' ? data.Runtime : null,
      rated: data.Rated !== 'N/A' ? data.Rated : null,
      year: data.Year !== 'N/A' ? data.Year : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});