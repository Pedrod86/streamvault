/**
 * Metadata Service — unified client for TMDb, Fanart.tv, TVmaze, Trakt
 * All results are cached in localStorage with a configurable TTL.
 */
import { base44 } from '@/api/base44Client';

const CACHE_PREFIX = 'sv_meta_';
const DEFAULT_TTL = 30 * 60 * 1000; // 30 min
const ARTWORK_TTL = 24 * 60 * 60 * 1000; // 24 h

function cacheKey(fn, args) {
  return `${CACHE_PREFIX}${fn}_${JSON.stringify(args)}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function writeCache(key, data, ttl = DEFAULT_TTL) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expires: Date.now() + ttl }));
  } catch { /* storage full — skip */ }
}

async function invoke(fn, payload, ttl = DEFAULT_TTL) {
  const key = cacheKey(fn, payload);
  const cached = readCache(key);
  if (cached !== null) return cached;
  const res = await base44.functions.invoke(fn, payload);
  const data = res.data;
  if (data && !data.error) writeCache(key, data, ttl);
  return data;
}

// ── TMDb ──────────────────────────────────────────────────────────────────────

export const tmdb = {
  trending: (media_type = 'all', page = 1) =>
    invoke('tmdbLookup', { action: 'trending', media_type, page }),

  popular: (media_type = 'movie', page = 1) =>
    invoke('tmdbLookup', { action: 'popular', media_type, page }),

  upcoming: (page = 1) =>
    invoke('tmdbLookup', { action: 'upcoming', page }),

  topRated: (media_type = 'movie', page = 1) =>
    invoke('tmdbLookup', { action: 'top_rated', media_type, page }),

  search: (query, page = 1) =>
    invoke('tmdbLookup', { action: 'search', query, page }, 10 * 60 * 1000),

  details: (tmdb_id, media_type = 'movie') =>
    invoke('tmdbLookup', { action: 'details', tmdb_id, media_type }, ARTWORK_TTL),

  recommendations: (tmdb_id, media_type = 'movie') =>
    invoke('tmdbLookup', { action: 'recommendations', tmdb_id, media_type }),
};

// ── TVmaze ────────────────────────────────────────────────────────────────────

export const tvmaze = {
  search: (query) =>
    invoke('tvmazeLookup', { action: 'search', query }, 10 * 60 * 1000),

  show: (tvmaze_id) =>
    invoke('tvmazeLookup', { action: 'show', tvmaze_id }, ARTWORK_TTL),

  lookup: (ids) =>
    invoke('tvmazeLookup', { action: 'lookup', ...ids }, ARTWORK_TTL),

  schedule: () =>
    invoke('tvmazeLookup', { action: 'schedule' }, 30 * 60 * 1000),
};

// ── Trakt ─────────────────────────────────────────────────────────────────────

export const trakt = {
  trendingMovies: () =>
    invoke('traktSync', { action: 'trending_movies' }, 15 * 60 * 1000),

  trendingShows: () =>
    invoke('traktSync', { action: 'trending_shows' }, 15 * 60 * 1000),

  popularMovies: () =>
    invoke('traktSync', { action: 'popular_movies' }, 15 * 60 * 1000),

  popularShows: () =>
    invoke('traktSync', { action: 'popular_shows' }, 15 * 60 * 1000),

  recommendations: (type = 'movies') =>
    invoke('traktSync', { action: `recommendations_${type}` }, 30 * 60 * 1000),

  syncHistory: () =>
    invoke('traktSync', { action: 'sync_history' }, 5 * 60 * 1000),

  progress: () =>
    invoke('traktSync', { action: 'progress' }, 5 * 60 * 1000),

  stats: () =>
    invoke('traktSync', { action: 'stats' }, 15 * 60 * 1000),

  collection: () =>
    invoke('traktSync', { action: 'collection' }, 30 * 60 * 1000),
};

// ── Cache management ──────────────────────────────────────────────────────────

export function clearMetadataCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
  return keys.length;
}

export function preloadImages(urls) {
  urls.filter(Boolean).forEach(url => {
    const img = new Image();
    img.src = url;
  });
}