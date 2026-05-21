import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'streamvault_emby_library';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours — re-scan if older than this

// ── Persistence helpers ──────────────────────────────────────────────────────

function saveCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      library: state.library,
      server: state.server,
      total: state.total,
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
  if (!cached.stale && scanState.startIndex >= scanState.total && scanState.total > 0) {
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

      // Persist this page to DB so content survives page refresh / other devices
      try {
        const dbItems = items.map(item => ({
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
          tags: ['emby'],
        }));
        // Fire-and-forget — don't block the scan
        base44.functions.invoke('embySync', { server: scanState.server, items: dbItems }).catch(() => {});
      } catch (_) {}
    }

    scanState.done = !hasMore || !items?.length;
    scanState.loading = false;
    scanState.fromCache = false;

    // Persist both cache and progress after a successful page
    saveCache(scanState);
    saveProgress(scanState.startIndex, scanState.total, scanState.server);
    notifyListeners();

    // Clear progress when scan is fully complete — next run starts fresh
    if (scanState.done) {
      clearProgress();
    } else {
      // 2s delay between pages to avoid hitting rate limits
      setTimeout(() => fetchPage(), 2000);
    }
  } catch (err) {
    // Persist the current index so resume starts from the last completed page
    saveProgress(scanState.startIndex, scanState.total, scanState.server);
    scanState.error = err.message || 'Failed to load library';
    scanState.loading = false;
    notifyListeners();
    // Auto-retry after 10s on transient errors (rate limits, timeouts)
    setTimeout(() => {
      if (!scanState.done && !scanState.loading) {
        scanState.error = null;
        fetchPage();
      }
    }, 10000);
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