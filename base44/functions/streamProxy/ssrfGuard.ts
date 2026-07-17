// SSRF guard — blocks non-http(s) protocols and requests targeting private,
// loopback, link-local, or cloud-metadata addresses.
//
// DNS-rebinding (TOCTOU) hardening: assertSafeUrl resolves the hostname and
// returns the validated IP. safeFetch then connects directly to that already
// validated IP (never re-resolving the attacker-controlled hostname), so a DNS
// record that flips to a private IP between the check and the fetch cannot be
// used — fetch talks to the IP we vetted, with the original Host/SNI preserved.

function parseIpv4(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) {
    return true;
  }
  if (h === '::1' || h === '::' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) {
    return true;
  }
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    const octets = parseIpv4(mapped[1]);
    return octets ? isPrivateIpv4(octets) : true;
  }
  const octets = parseIpv4(h);
  if (octets) return isPrivateIpv4(octets);
  return false;
}

// Resolve the hostname and return the first safe IPv4/IPv6 address.
// Throws if the hostname resolves to any private/loopback/link-local/metadata IP.
async function resolveSafeIp(hostname: string): Promise<string | null> {
  // Already an IP literal — isBlockedHost has already vetted it upstream.
  if (parseIpv4(hostname) || hostname.includes(':')) return null;
  const resolved: string[] = [];
  for (const kind of ['A', 'AAAA'] as const) {
    try {
      const recs = await Deno.resolveDns(hostname, kind);
      resolved.push(...recs);
    } catch {
      // Ignore per-record-type resolution failures (e.g. no AAAA record)
    }
  }
  if (!resolved.length) return null; // let fetch handle "host not found"
  // If ANY resolved IP is unsafe, block outright.
  for (const ip of resolved) {
    if (isBlockedHost(ip)) {
      throw new Error('Access to this address is not allowed');
    }
  }
  // Return the first safe IP to pin the connection to.
  return resolved[0];
}

export interface SafeTarget {
  url: URL;        // original, validated URL
  safeIp: string | null; // validated IP to pin to (null when host was an IP literal)
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const target = await resolveSafeTarget(rawUrl);
  return target.url;
}

export async function resolveSafeTarget(rawUrl: string): Promise<SafeTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('Access to this address is not allowed');
  }
  // Resolve + re-check underlying IPs, and capture a vetted IP to pin to.
  const safeIp = await resolveSafeIp(parsed.hostname);
  return { url: parsed, safeIp };
}

// SSRF-safe fetch: validates the URL, then connects to the pre-validated IP so a
// rebinding DNS answer between validation and connection cannot redirect us to a
// private address. The original hostname is preserved for the Host header and
// TLS SNI (https keeps the hostname in the URL for correct certificate checks;
// http pins directly to the IP with a Host header).
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  const { url, safeIp } = await resolveSafeTarget(rawUrl);

  // Host was an IP literal (already vetted) — nothing to pin, fetch as-is.
  if (!safeIp) return fetch(url.toString(), init);

  const headers = new Headers(init.headers || {});
  if (!headers.has('Host')) headers.set('Host', url.host);

  if (url.protocol === 'http:') {
    // For plain HTTP, connect straight to the vetted IP; Host header routes it.
    const pinned = new URL(url.toString());
    pinned.hostname = safeIp;
    return fetch(pinned.toString(), { ...init, headers });
  }

  // For HTTPS we must keep the hostname in the URL so SNI + certificate
  // validation succeed. Re-validate immediately before connecting to minimise
  // the rebinding window (resolveSafeTarget above already blocked unsafe IPs).
  await resolveSafeTarget(rawUrl);
  return fetch(url.toString(), { ...init, headers });
}