import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Search LibriVox (free public domain audiobooks) + Open Library for metadata
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { query, action, bookId } = body;

    // ── Save a book to the library ───────────────────────────────────────────
    if (action === 'save' && bookId) {
      // Writing to the shared Media catalogue is an admin-only operation.
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — admin role required' }, { status: 403 });
      }
      const { title, author, coverUrl, description, year, genres, streamUrl, chapters } = body;

      // Check not already saved
      const existing = await base44.entities.Media.filter({ title });
      if (existing.length > 0) {
        return Response.json({ success: false, error: 'Already in your library', existing: existing[0] });
      }

      const mediaRecord = await base44.entities.Media.create({
        title,
        media_type: 'movie', // we repurpose — audiobooks don't have a type yet
        description: description || '',
        poster_url: coverUrl || '',
        video_url: streamUrl || '',
        year: year ? parseInt(year) : null,
        director: author || '',
        genre: genres || ['Audiobook'],
        tags: ['audiobook', ...(genres || [])],
        is_featured: false,
      });

      return Response.json({ success: true, media: mediaRecord });
    }

    // ── Search LibriVox ──────────────────────────────────────────────────────
    if (!query || query.trim().length < 2) {
      return Response.json({ results: [] });
    }

    const q = encodeURIComponent(query.trim());

    // LibriVox API — free public domain audiobooks
    const librivoxUrl = `https://librivox.org/api/feed/audiobooks/?title=${q}&format=json&extended=1&limit=20`;
    const lvRes = await fetch(librivoxUrl, {
      headers: { 'User-Agent': 'StreamVault/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    let lvBooks = [];
    if (lvRes.ok) {
      const lvData = await lvRes.json().catch(() => ({}));
      lvBooks = (lvData.books || []).map(b => {
        // Pick the first chapter's URL as the stream (MP3)
        const firstChapter = b.sections?.[0];
        const streamUrl = firstChapter?.listen_url || null;
        const allChapters = (b.sections || []).map((s, i) => ({
          index: i,
          name: s.title || `Chapter ${i + 1}`,
          listen_url: s.listen_url,
          duration: s.playtime || '',
          reader: s.readers?.[0]?.display_name || '',
        }));

        const coverUrl = b.id
          ? `https://archive.org/services/img/${b.url_text_source?.split('/').pop() || b.id}`
          : null;

        return {
          id: `lv_${b.id}`,
          source: 'librivox',
          title: b.title || 'Unknown',
          author: b.authors?.map(a => `${a.first_name} ${a.last_name}`.trim()).join(', ') || '',
          description: b.description || '',
          year: b.copyright_year || null,
          genres: b.genres?.map(g => g.name) || ['Audiobook'],
          coverUrl,
          streamUrl,
          chapters: allChapters,
          totalSections: b.num_sections || 1,
          language: b.language || 'English',
          runtime: b.totaltimesecs ? Math.round(b.totaltimesecs / 60) : null,
          librivoxUrl: b.url_librivox || null,
          license: 'Public Domain (LibriVox)',
        };
      });
    }

    // Also search by author if no title results
    if (lvBooks.length === 0) {
      const authorUrl = `https://librivox.org/api/feed/audiobooks/?author=${q}&format=json&extended=1&limit=20`;
      const authorRes = await fetch(authorUrl, {
        headers: { 'User-Agent': 'StreamVault/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (authorRes.ok) {
        const authorData = await authorRes.json().catch(() => ({}));
        lvBooks = (authorData.books || []).map(b => {
          const firstChapter = b.sections?.[0];
          const streamUrl = firstChapter?.listen_url || null;
          const allChapters = (b.sections || []).map((s, i) => ({
            index: i,
            name: s.title || `Chapter ${i + 1}`,
            listen_url: s.listen_url,
            duration: s.playtime || '',
          }));
          return {
            id: `lv_${b.id}`,
            source: 'librivox',
            title: b.title || 'Unknown',
            author: b.authors?.map(a => `${a.first_name} ${a.last_name}`.trim()).join(', ') || '',
            description: b.description || '',
            year: b.copyright_year || null,
            genres: b.genres?.map(g => g.name) || ['Audiobook'],
            coverUrl: null,
            streamUrl,
            chapters: allChapters,
            totalSections: b.num_sections || 1,
            language: b.language || 'English',
            runtime: b.totaltimesecs ? Math.round(b.totaltimesecs / 60) : null,
            librivoxUrl: b.url_librivox || null,
            license: 'Public Domain (LibriVox)',
          };
        });
      }
    }

    return Response.json({ results: lvBooks });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});