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

// ── Singleton state ──────────────────────────────────────────────────────────

export const scanState = {
  library: [],
  server: null,
  startIndex: 0,
  total: 0,
  done: false,
  loading: false,
  error: null,
  fromCache: false,   // true when data was restored from localStorage
  listeners: new Set(),
};

// Restore from cache immediately (synchronous, before first render)
const cached = loadCache();
if (cached) {
  scanState.library = cached.library;
  scanState.server = cached.server;
  scanState.total = cached.total;
  scanState.startIndex = cached.library.length;
  scanState.fromCache = true;
  // If cache is fresh and we have all items, mark as done
  if (!cached.stale && cached.library.length >= cached.total && cached.total > 0) {
    scanState.done = true;
  }
}

function notifyListeners() {
  scanState.listeners.forEach(fn => fn({ ...scanState }));
}

// ── Load one page of results ─────────────────────────────────────────────────

export async function runScan() {
  if (scanState.loading || scanState.done) return;

  scanState.loading = true;
  scanState.error = null;
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
    }

    scanState.done = !hasMore || !items?.length;
    scanState.loading = false;
    scanState.fromCache = false;

    // Persist to localStorage after every page
    saveCache(scanState);

    notifyListeners();
  } catch (err) {
    scanState.error = err.message || 'Failed to load library';
    scanState.loading = false;
    notifyListeners();
  }
}

// ── Full refresh (clears cache + restarts scan) ──────────────────────────────

export function resetScan() {
  clearCache();
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