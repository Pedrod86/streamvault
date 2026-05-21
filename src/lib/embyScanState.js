import { base44 } from '@/api/base44Client';

// Module-level singleton — persists for the entire app session (survives navigation)
export const scanState = {
  library: [],
  server: null,
  startIndex: 0,
  total: 0,
  done: false,
  loading: false,
  error: null,
  listeners: new Set(),
};

function notifyListeners() {
  scanState.listeners.forEach(fn => fn({ ...scanState }));
}

// Load one page of results. Call repeatedly to load more.
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
    notifyListeners();
  } catch (err) {
    scanState.error = err.message || 'Failed to load library';
    scanState.loading = false;
    notifyListeners();
  }
}

export function resetScan() {
  scanState.library = [];
  scanState.server = null;
  scanState.startIndex = 0;
  scanState.total = 0;
  scanState.done = false;
  scanState.loading = false;
  scanState.error = null;
  notifyListeners();
}