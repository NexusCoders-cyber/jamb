/**
 * SERVER ONLY. Fetch an image from an arbitrary public URL without becoming an SSRF hole.
 *
 * Used by /api/image-proxy as the fallback for question diagrams the browser cannot load
 * directly (host serves plain http only, blocks hot-linking, has a broken certificate …).
 *
 * Guarantees:
 *  - only http(s) on the default ports, no credentials in the URL
 *  - every hostname is resolved HERE and refused if ANY answer is a private / loopback /
 *    link-local / metadata / reserved address; the connection is then pinned to the checked
 *    address, so DNS rebinding cannot swap it afterwards
 *  - redirects are followed manually (max 3) and every hop is validated again
 *  - hard caps on time (10s) and size (6 MB)
 *  - the content type is decided by sniffing the bytes, never by the upstream header,
 *    so HTML can never be re-served from our origin as an "image"
 */
import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";

export type SafeFetchErrorCode = "bad-url" | "blocked" | "too-large" | "not-image" | "upstream-status" | "network" | "tls" | "too-many-redirects";

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const MAX_BYTES = 6 * 1024 * 1024;
const TOTAL_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; QubitImageProxy/1.0)";

// ─── Address policy ──────────────────────────────────────────────────────────
const blocked = new net.BlockList();
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const BLOCKED_V6: [string, number][] = [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
];
for (const [addr, prefix] of BLOCKED_V4) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of BLOCKED_V6) blocked.addSubnet(addr, prefix, "ipv6");

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (!family) return true;
  try {
    return blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
  } catch {
    return true; // anything we cannot classify is refused
  }
}

function bareHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "");
}

function validateTarget(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("bad-url", "Only http and https images can be loaded.");
  if (url.username || url.password) throw new SafeFetchError("bad-url", "URLs with credentials are not allowed.");
  const defaultPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== defaultPort) throw new SafeFetchError("bad-url", "Only the standard web ports are allowed.");
  const host = bareHost(url.hostname).toLowerCase();
  if (!host || host.length > 253) throw new SafeFetchError("bad-url", "Invalid host.");
  if (host === "localhost" || /\.(?:localhost|local|internal|lan|home|corp)$/.test(host)) throw new SafeFetchError("blocked", "That host is not allowed.");
}

type Pinned = { address: string; family: 4 | 6 };

async function resolveSafe(hostname: string): Promise<Pinned> {
  const host = bareHost(hostname);
  const literal = net.isIP(host);
  if (literal) {
    if (isBlockedAddress(host)) throw new SafeFetchError("blocked", "That address is not allowed.");
    return { address: host, family: literal === 4 ? 4 : 6 };
  }
  let answers: { address: string; family: number }[];
  try {
    answers = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError("network", "The image host could not be found.");
  }
  if (answers.length === 0) throw new SafeFetchError("network", "The image host could not be found.");
  if (answers.some((a) => isBlockedAddress(a.address))) throw new SafeFetchError("blocked", "That host resolves to a private address.");
  return { address: answers[0].address, family: answers[0].family === 6 ? 6 : 4 };
}

// ─── Content sniffing ────────────────────────────────────────────────────────
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  const head6 = buf.subarray(0, 6).toString("latin1");
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  if (buf.length >= 12 && buf.subarray(4, 12).toString("latin1") === "ftypavif") return "image/avif";
  const text = buf.subarray(0, 600).toString("utf8").trimStart().toLowerCase();
  if (text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"))) return "image/svg+xml";
  return null;
}

// ─── One validated request ───────────────────────────────────────────────────
type HopResult = { kind: "body"; buffer: Buffer } | { kind: "redirect"; location: string } | { kind: "status"; status: number };

function requestOnce(url: URL, pinned: Pinned, deadline: number): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new SafeFetchError("network", "The image took too long to load."));
      return;
    }
    const isHttps = url.protocol === "https:";
    const host = bareHost(url.hostname);
    const lib = isHttps ? https : http;

    const options: https.RequestOptions = {
      host,
      port: url.port ? Number(url.port) : isHttps ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.5", "accept-encoding": "identity" },
      // Connect to the address we already vetted — never re-resolve
      lookup: ((_h: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => {
        if (opts && opts.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
        else cb(null, pinned.address, pinned.family);
      }) as unknown as https.RequestOptions["lookup"],
      servername: net.isIP(host) ? undefined : host,
    };

    const timer = setTimeout(() => req.destroy(new SafeFetchError("network", "The image took too long to load.")), remaining);
    const fail = (err: unknown) => {
      clearTimeout(timer);
      if (err instanceof SafeFetchError) return reject(err);
      const code = (err as NodeJS.ErrnoException | undefined)?.code ?? "";
      const tls = /^(?:EPROTO|ECONNRESET|ECONNREFUSED|ERR_SSL|ERR_TLS|CERT_|DEPTH_ZERO|UNABLE_TO_|SELF_SIGNED|HPE_)/.test(code) && isHttps;
      reject(new SafeFetchError(tls ? "tls" : "network", "The image host could not be reached."));
    };

    const req = lib.request(options, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        clearTimeout(timer);
        resolve({ kind: "redirect", location: String(res.headers.location) });
        return;
      }
      if (status !== 200) {
        res.resume();
        clearTimeout(timer);
        resolve({ kind: "status", status });
        return;
      }
      const declared = Number(res.headers["content-length"] ?? 0);
      if (declared > MAX_BYTES) {
        res.destroy();
        clearTimeout(timer);
        reject(new SafeFetchError("too-large", "The image is too large."));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          res.destroy();
          clearTimeout(timer);
          reject(new SafeFetchError("too-large", "The image is too large."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        clearTimeout(timer);
        resolve({ kind: "body", buffer: Buffer.concat(chunks) });
      });
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}

export type SafeImage = { buffer: Buffer; contentType: string; finalUrl: string };

/** Fetch one image URL under the policy above. Throws SafeFetchError. */
export async function fetchImageSafely(input: string): Promise<SafeImage> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError("bad-url", "That is not a valid image address.");
  }
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    validateTarget(url);
    const pinned = await resolveSafe(url.hostname);
    const result = await requestOnce(url, pinned, deadline);

    if (result.kind === "redirect") {
      try {
        url = new URL(result.location, url);
      } catch {
        throw new SafeFetchError("bad-url", "The image host sent a bad redirect.");
      }
      continue;
    }
    if (result.kind === "status") {
      throw new SafeFetchError("upstream-status", `The image host answered with HTTP ${result.status}.`, result.status);
    }
    const contentType = sniffImageType(result.buffer);
    if (!contentType) throw new SafeFetchError("not-image", "That address is not an image.");
    return { buffer: result.buffer, contentType, finalUrl: url.href };
  }
  throw new SafeFetchError("too-many-redirects", "The image host redirected too many times.");
}

/**
 * Same as fetchImageSafely, but when an https address cannot be reached because the host does not
 * really speak TLS (many old educational image hosts are http-only) it retries the same path over http.
 * This is the one place a downgrade is allowed — the bytes are validated as an image either way.
 */
export async function fetchImageWithHttpFallback(input: string): Promise<SafeImage> {
  try {
    return await fetchImageSafely(input);
  } catch (err) {
    if (err instanceof SafeFetchError && err.code === "tls" && /^https:/i.test(input)) {
      return fetchImageSafely(input.replace(/^https:/i, "http:"));
    }
    throw err;
  }
}
