import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'streamvault_emby_library';
const DB_FLUSH_THRESHOLD = 58; // auto-save to DB once we have this many new items buffered
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — re-scan if older than this

// ── Persistence helpers ──────────────────────────────────────────────────────

function saveCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      library: state.library,
      server: state.server,
      total: state.total,
      done: state.done,
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.library?.length) return null;
    const age = Date.now() - (data.savedAt || 0);
    return { ...data, stale: age > CACHE_MAX_AGE_MS };
  } catch (_) {
    return null;
  }
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

// ── Progress persistence (separate from library cache) ──────────────────────

const PROGRESS_KEY = 'streamvault_emby_scan_progress';

function saveProgress(startIndex, total, server) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ startIndex, total, server, savedAt: Date.now() }));
  } catch (_) {}
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const age = Date.now() - (data.savedAt || 0);
    // Progress is valid for 24 hours
    if (age > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch (_) { return null; }
}

function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
}

// ── Singleton state ──────────────────────────────────────────────────────────

export const scanState = {
  library: [],
  server: null,
  startIndex: 0,
  total: 0,
  done: false,
  loading: false,
  error: null,
  fromCache: false,
  listeners: new Set(),
  _pendingDbItems: [], // items buffered for auto-flush to DB
};

// Restore progress from localStorage so we resume where we left off
const savedProgress = loadProgress();
if (savedProgress) {
  scanState.startIndex = savedProgress.startIndex || 0;
  scanState.total = savedProgress.total || 0;
  scanState.server = savedProgress.server || null;
  scanState.fromCache = scanState.startIndex > 0;
  if (scanState.startIndex > 0 && scanState.total > 0 && scanState.startIndex >= scanState.total) {
    scanState.done = true;
  }
}

// Also restore library cache for in-memory display
const cached = loadCache();
if (cached) {
  scanState.library = cached.library;
  if (!scanState.server && cached.server) scanState.server = cached.server;
  if (!scanState.total && cached.total) scanState.total = cached.total;
  // startIndex must equal actual fetched item count so the next page request
  // uses the correct offset — take whichever is larger between progress and cache
  scanState.startIndex = Math.max(scanState.startIndex, cached.library.length);
  // Restore done flag — if cache is fresh and was marked done, stay done
  if (!cached.stale && cached.done) {
    scanState.done = true;
  } else if (!cached.stale && scanState.startIndex >= scanState.total && scanState.total > 0) {
    scanState.done = true;
  }
}

function notifyListeners() {
  scanState.listeners.forEach(fn => fn({ ...scanState }));
}

// ── Load one page and automatically continue until done ──────────────────────

async function fetchPage() {
  if (scanState.loading || scanState.done) return;

  scanState.loading = true;
  scanState.error = null;
  // Persist the current index BEFORE the fetch — so if the page is closed
  // mid-request, we resume from the last *completed* page, not from zero.
  saveProgress(scanState.startIndex, scanState.total, scanState.server);
  notifyListeners();

  try {
    const res = await base44.functions.invoke('embyLibrary', { startIndex: scanState.startIndex });
    if (res.data?.error) throw new Error(res.data.error);

    const { items, hasMore, total, server } = res.data;

    if (!scanState.server && server) scanState.server = server;
    if (total) scanState.total = total;

    if (items?.length) {
      scanState.library = [...scanState.library, ...items];
      scanState.startIndex += items.length;

      // Buffer items for auto-flush to DB
      const dbItems = items.map(item => {
        const tags = ['emby', `emby:${item.id}`];
        if (item.is4k) tags.push('4k');
        return {
          emby_id: item.id,
          title: item.title,
          media_type: item.type === 'Series' ? 'tv_show' : 'movie',
          description: item.overview || '',
          year: item.year || undefined,
          rating: item.rating || undefined,
          duration_minutes: item.duration || undefined,
          poster_url: item.posterUrl || undefined,
          backdrop_url: item.backdropUrl || undefined,
          video_url: item.streamUrl || undefined,
          genre: item.genres || [],
          tags,
        };
      });
      scanState._pendingDbItems = [...scanState._pendingDbItems, ...dbItems];
    }

    scanState.done = !hasMore || !items?.length;
    scanState.loading = false;
    scanState.fromCache = false;

    // Persist both cache and progress after a successful page
    saveCache(scanState);
    saveProgress(scanState.startIndex, scanState.total, scanState.server);
    notifyListeners();

    // Auto-flush to DB once we have 58+ items buffered, or when scan is done
    const shouldFlush = scanState._pendingDbItems.length >= DB_FLUSH_THRESHOLD || (scanState.done && scanState._pendingDbItems.length > 0);
    if (shouldFlush && scanState.server) {
      const toFlush = [...scanState._pendingDbItems];
      scanState._pendingDbItems = [];
      base44.functions.invoke('embySync', { server: scanState.server, items: toFlush }).catch(() => {});
    }

    // Clear progress when scan is fully complete — next run starts fresh
    if (scanState.done) {
      clearProgress();
    } else {
      // 5s delay between pages to avoid hitting rate limits
      setTimeout(() => fetchPage(), 5000);
    }
  } catch (err) {
    // Persist the current index so resume starts from the last completed page
    saveProgress(scanState.startIndex, scanState.total, scanState.server);
    scanState.error = err.message || 'Failed to load library';
    scanState.loading = false;
    notifyListeners();
    // Rate limit: back off 5 minutes. Other errors: retry after 30s.
    const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
    const retryDelay = isRateLimit ? 5 * 60 * 1000 : 30_000;
    setTimeout(() => {
      if (!scanState.done && !scanState.loading) {
        scanState.error = null;
        fetchPage();
      }
    }, retryDelay);
  }
}

export async function runScan() {
  if (scanState.loading || scanState.done) return;
  fetchPage();
}

// ── Full refresh (clears cache + restarts scan) ──────────────────────────────

export function resetScan() {
  clearCache();
  clearProgress();
  scanState.library = [];
  scanState.server = null;
  scanState.startIndex = 0;
  scanState.total = 0;
  scanState.done = false;
  scanState.loading = false;
  scanState.error = null;
  scanState.fromCache = false;
  notifyListeners();
}