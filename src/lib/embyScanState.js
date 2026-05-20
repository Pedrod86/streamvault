import { base44 } from '@/api/base44Client';

// Module-level singleton — persists for the entire app session (survives navigation)
export const scanState = {
  library: [],
  server: null,
  startIndex: 0,
  done: false,
  loading: false,
  error: null,
  listeners: new Set(),
};

function notifyListeners() {
  scanState.listeners.forEach(fn => fn({ ...scanState }));
}

export async function runScan() {
  if (scanState.loading || scanState.done) return;
  scanState.loading = true;
  scanState.error = null;
  notifyListeners();

  const BATCH = 500;
  const PAUSE_AT = 5000;

  try {
    while (!scanState.done) {
      const res = await base44.functions.invoke('embyLibrary', { startIndex: scanState.startIndex });
      if (res.data?.error) throw new Error(res.data.error);
      const { items, hasMore, server } = res.data;

      if (!scanState.server && server) scanState.server = server;
      if (items?.length) {
        scanState.library = [...scanState.library, ...items];
        scanState.startIndex += items.length;
      }
      if (!hasMore || !items?.length) {
        scanState.done = true;
        scanState.loading = false;
        notifyListeners();
        break;
      }

      notifyListeners();

      if (scanState.startIndex % PAUSE_AT < BATCH) {
        scanState.loading = false;
        notifyListeners();
        await new Promise(r => setTimeout(r, 2000));
        scanState.loading = true;
        notifyListeners();
      }
    }
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
  scanState.done = false;
  scanState.loading = false;
  scanState.error = null;
  notifyListeners();
}