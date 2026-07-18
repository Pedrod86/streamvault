// SSRF guard — blocks non-http(s) protocols and requests targeting private,
// loopback, link-local, or cloud-metadata addresses.

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

async function assertSafeResolvedIps(hostname: string): Promise<void> {
  // If it's already an IP literal, isBlockedHost already covered it.
  if (parseIpv4(hostname) || hostname.includes(':')) return;
  const resolved: string[] = [];
  for (const kind of ['A', 'AAAA'] as const) {
    try {
      const recs = await Deno.resolveDns(hostname, kind);
      resolved.push(...recs);
    } catch {
      // Ignore per-record-type resolution failures (e.g. no AAAA record)
    }
  }
  // If DNS resolves to any private/loopback/link-local/metadata IP, block it.
  for (const ip of resolved) {
    if (isBlockedHost(ip)) {
      throw new Error('Access to this address is not allowed');
    }
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
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
  // Resolve the hostname and re-check the underlying IPs to defeat DNS rebinding.
  await assertSafeResolvedIps(parsed.hostname);
  return parsed;
}