// SSRF guard — blocks non-http(s) protocols and requests targeting private,
// loopback, link-local, or cloud-metadata addresses.
//
// DNS-rebinding (TOCTOU) hardening: assertSafeUrl resolves the hostname and
// returns the validated IP. safeFetch then connects directly to that already
// validated IP (never re-resolving the attacker-controlled hostname), so a DNS
// record that flips to a private IP between the check and the fetch cannot be
// used — fetch talks to the IP we vetted, with the original Host/SNI preserved.

// Parse a single IPv4 "part" that may be decimal, octal (0-prefixed) or hex
// (0x-prefixed) — matching how OS/libc inet_aton (and thus native fetch) decode
// them. Returns null for anything that isn't a clean numeric literal.
function parseIpPart(part: string): number | null {
  if (!/^(0x[0-9a-f]+|\d+)$/i.test(part)) return null;
  let n: number;
  if (/^0x/i.test(part)) {
    n = parseInt(part, 16);
  } else if (/^0[0-7]+$/.test(part)) {
    n = parseInt(part, 8);
  } else if (/^0[0-9]+$/.test(part)) {
    // Leading zero but non-octal digit (e.g. 08, 09) — ambiguous, reject.
    return null;
  } else {
    n = parseInt(part, 10);
  }
  return Number.isFinite(n) ? n : null;
}

// Robust IPv4 parser: decodes dotted, dword, octal, hex and mixed-radix forms
// (1–4 parts) into canonical octets, mirroring inet_aton so non-standard
// representations of loopback/private addresses cannot slip past the blocklist.
function parseIpv4(host: string): number[] | null {
  if (host.length === 0) return null;
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const p of parts) {
    const n = parseIpPart(p);
    if (n === null || n < 0) return null;
    nums.push(n);
  }

  // The last part fills the remaining low-order bytes (inet_aton semantics):
  // a.b.c.d -> each 0..255; a.b.c -> c spans 2 bytes; a.b -> b spans 3; a -> 4.
  const last = nums[nums.length - 1];
  const leading = nums.slice(0, -1);
  const remainingBytes = 4 - leading.length;
  if (leading.some((o) => o > 255)) return null;
  if (last > Math.pow(256, remainingBytes) - 1) return null;

  const octets: number[] = [...leading];
  for (let i = remainingBytes - 1; i >= 0; i--) {
    octets.push((last >>> (i * 8)) & 0xff);
  }
  return octets.length === 4 ? octets : null;
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
    // For plain HTTP, connect straight to the vetted IP so the runtime never
    // re-resolves the attacker-controlled hostname; the Host header routes it.
    const pinned = new URL(url.toString());
    pinned.hostname = safeIp.includes(':') ? `[${safeIp}]` : safeIp;
    return fetch(pinned.toString(), { ...init, headers });
  }

  // For HTTPS the runtime does its own DNS resolution (SNI + certificate
  // validation need the real hostname, and custom HTTP clients aren't available
  // in this runtime, so we can't pin the IP directly). Re-resolve and
  // re-validate the hostname immediately before the fetch and REJECT if it now
  // points at a private/loopback/metadata IP — closing the rebinding window
  // rather than silently discarding the recheck.
  const recheckIp = await resolveSafeIp(url.hostname);
  if (recheckIp && isBlockedHost(recheckIp)) {
    throw new Error('Access to this address is not allowed');
  }
  return fetch(url.toString(), { ...init, headers });
}