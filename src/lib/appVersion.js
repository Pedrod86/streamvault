// Currently installed app version. BUMP THIS on every release so the
// "Update available" banner knows when the device is behind the latest
// GitHub release. Keep the format matching your GitHub release tag.
export const APP_VERSION = 'v1.1';

// Normalises a version/tag string to a comparable number array.
// e.g. "v1.1" -> [1, 1], "1.2.3" -> [1, 2, 3]
function parseVersion(v) {
  if (!v) return [0];
  return String(v)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

// Returns true if `latest` is a newer version than `current`.
export function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Triggers an APK download in-place (no new browser tab). The file lands in
// the device's Downloads folder and Android shows its install prompt.
export function downloadApk(url, fileName) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}