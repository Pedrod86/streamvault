/**
 * Emby → StreamVault Media format mapper
 *
 * Handles all field translation, image URL construction, rating
 * normalisation, content-rating mapping, and title sanitisation.
 */

// Emby OfficialRating values → StreamVault content_rating enum
const CONTENT_RATING_MAP = {
  'G': 'G',
  'PG': 'PG',
  'PG-13': 'PG-13',
  'PG13': 'PG-13',
  'R': 'R',
  'NC-17': 'NC-17',
  'NC17': 'NC-17',
  'TV-Y': 'TV-Y',
  'TVY': 'TV-Y',
  'TV-G': 'TV-G',
  'TVG': 'TV-G',
  'TV-PG': 'TV-PG',
  'TVPG': 'TV-PG',
  'TV-14': 'TV-14',
  'TV14': 'TV-14',
  'TV-MA': 'TV-MA',
  'TVMA': 'TV-MA',
};

/**
 * Normalise a rating value to a 1-decimal float clamped to 0–10,
 * returning undefined if unavailable or invalid.
 */
function normaliseRating(raw) {
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) return undefined;
  return parseFloat(Math.min(10, Math.max(0, n)).toFixed(1));
}

/**
 * Map an Emby OfficialRating string to a StreamVault content_rating enum value.
 * Returns undefined if unrecognised.
 */
function mapContentRating(officialRating) {
  if (!officialRating) return undefined;
  const key = officialRating.trim().toUpperCase().replace(/\s/g, '');
  // Direct lookup
  const direct = CONTENT_RATING_MAP[officialRating.trim()];
  if (direct) return direct;
  // Normalised lookup
  for (const [k, v] of Object.entries(CONTENT_RATING_MAP)) {
    if (k.toUpperCase().replace(/\s/g, '') === key) return v;
  }
  return undefined;
}

/**
 * Strip invisible Unicode control/formatting characters from titles
 * (e.g. U+200E LEFT-TO-RIGHT MARK that Emby sometimes prepends).
 */
function cleanTitle(name) {
  if (!name) return '';
  return name.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim();
}

/**
 * Build the Emby image URL for a given item and image type.
 * Uses the token as a query param (api_key) which Emby accepts.
 */
function imageUrl(base, itemId, type, tag, token) {
  if (!tag) return undefined;
  return `${base}/Items/${itemId}/Images/${type}/0?tag=${tag}&api_key=${token}&maxWidth=400`;
}

function backdropUrl(base, itemId, tags, token) {
  if (!tags || !tags.length) return undefined;
  return `${base}/Items/${itemId}/Images/Backdrop/0?tag=${tags[0]}&api_key=${token}&maxWidth=1280`;
}

/**
 * Map a single Emby API item to the StreamVault Media entity format.
 *
 * @param {object} item  - Raw item from Emby /Users/{id}/Items response
 * @param {string} base  - Server base URL (no trailing slash)
 * @param {string} token - Emby API token
 * @returns {object}     - StreamVault-compatible Media object
 */
export function mapEmbyItem(item, base, token) {
  const isMovie = item.Type === 'Movie';
  const isSeries = item.Type === 'Series';

  const poster = imageUrl(base, item.Id, 'Primary', item.ImageTags?.Primary, token);
  const backdrop = backdropUrl(base, item.Id, item.BackdropImageTags, token);
  const videoUrl = isMovie
    ? `${base}/Videos/${item.Id}/stream?api_key=${token}&Static=true`
    : undefined;

  return {
    title: cleanTitle(item.Name),
    media_type: isSeries ? 'tv_show' : 'movie',
    description: item.Overview || '',
    year: item.ProductionYear ? Number(item.ProductionYear) : undefined,
    rating: normaliseRating(item.CommunityRating),
    duration_minutes: item.RunTimeTicks
      ? Math.round(item.RunTimeTicks / 600000000)
      : undefined,
    poster_url: poster,
    backdrop_url: backdrop,
    video_url: videoUrl,
    genre: Array.isArray(item.Genres) ? item.Genres : [],
    director: item.People?.find(p => p.Type === 'Director')?.Name || undefined,
    cast: item.People
      ?.filter(p => p.Type === 'Actor')
      .slice(0, 8)
      .map(p => p.Name) || [],
    studio: item.Studios?.[0]?.Name || undefined,
    content_rating: mapContentRating(item.OfficialRating),
    season_count: isSeries && item.ChildCount ? Number(item.ChildCount) : undefined,
    episode_count: isSeries && item.RecursiveItemCount ? Number(item.RecursiveItemCount) : undefined,
    tags: ['emby'],
  };
}