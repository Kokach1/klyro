import * as dns from "dns/promises";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { getDomain } from "tldts";

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  text: string;
  contentLength: number;
}

export class SafeFetchError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Checks whether an IPv4 address is in private, loopback, link-local, multicast or reserved ranges.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 treated as unsafe
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;
  // 10.0.0.0/8 - Private
  if (a === 10) return true;
  // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;
  // 169.254.0.0/16 - Link-local / AWS metadata
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 - IETF Protocol Assignments
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 - TEST-NET-1
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 - 6to4 Relay
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 - Network benchmark tests
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 - TEST-NET-2
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 - TEST-NET-3
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 - Reserved
  if (a >= 240) return true;
  // 255.255.255.255 - Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is private, loopback, link-local, multicast or reserved.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1) and Unspecified (::)
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.substring(7);
    if (v4Part.includes(".")) {
      return isPrivateOrReservedIPv4(v4Part);
    }
  }

  // Unique Local Address (ULA) fc00::/7 (fc00:: to fdff::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-Local fe80::/10 (fe80:: to febf::)
  if (/^fe[89ab]/i.test(normalized)) return true;

  // Multicast ff00::/8
  if (normalized.startsWith("ff")) return true;

  // Documentation 2001:db8::/32
  if (normalized.startsWith("2001:db8:") || normalized.startsWith("2001:0db8:")) return true;

  // Discard 100::/64
  if (normalized.startsWith("100:")) return true;

  // 6to4 2002::/16
  if (normalized.startsWith("2002:")) return true;

  return false;
}

/**
 * Validates that an IP address is a public address.
 */
export function isPublicIP(ip: string): boolean {
  if (ip.includes(":")) {
    return !isPrivateOrReservedIPv6(ip);
  }
  return !isPrivateOrReservedIPv4(ip);
}

/**
 * Validates URL format and rules:
 * - Must be http: or https:
 * - No user credentials in URL
 * - Must not be localhost or local domains
 */
export function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("Invalid URL format.", "invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SafeFetchError("Only HTTP and HTTPS protocols are permitted.", "unsupported_protocol");
  }

  if (parsed.username || parsed.password) {
    throw new SafeFetchError("URLs containing user credentials are not allowed.", "credentials_rejected");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SafeFetchError("Local and private hosts are rejected.", "private_host_rejected");
  }

  return parsed;
}

/**
 * Resolves a hostname, verifies all resolved IPs are public, and returns the verified IPs.
 */
export async function resolveAndValidateHostname(hostname: string): Promise<string[]> {
  // If hostname is already an IP
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":")) {
    if (!isPublicIP(hostname)) {
      throw new SafeFetchError(`Access to non-public IP (${hostname}) is blocked.`, "private_ip_rejected");
    }
    return [hostname];
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err: any) {
    throw new SafeFetchError(`DNS resolution failed for ${hostname}: ${err.message}`, "dns_resolution_failed");
  }

  if (!addresses || addresses.length === 0) {
    throw new SafeFetchError(`No DNS records found for ${hostname}.`, "dns_resolution_failed");
  }

  for (const entry of addresses) {
    if (!isPublicIP(entry.address)) {
      throw new SafeFetchError(
        `Hostname ${hostname} resolved to a non-public IP address (${entry.address}).`,
        "private_ip_rejected"
      );
    }
  }

  return addresses.map((a) => a.address);
}

/**
 * Extract public registrable domain using tldts.
 * Discards job boards, free mail providers, or invalid domains.
 */
export function extractEmployerRegistrableDomain(domainOrUrl: string | null): string | null {
  if (!domainOrUrl) return null;

  let cleaned = domainOrUrl.trim();
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      cleaned = new URL(cleaned).hostname;
    } catch {
      // keep cleaned as is
    }
  }

  const parsedDomain = getDomain(cleaned);
  if (!parsedDomain) return null;

  const lower = parsedDomain.toLowerCase();
  // Filter common job boards or free email providers per spec
  const excludedDomains = [
    "linkedin.com",
    "indeed.com",
    "naukri.com",
    "glassdoor.com",
    "monster.com",
    "foundit.in",
    "internshala.com",
    "workindia.in",
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "protonmail.com",
    "icloud.com",
  ];

  if (excludedDomains.includes(lower)) {
    return null;
  }

  return lower;
}

/**
 * Domains known to always block outbound server HTTP requests (anti-scraping walls).
 * Skipping direct fetch for these prevents wasting bounded request quotas.
 */
export const ALWAYS_BLOCKED_SCRAPE_DOMAINS = [
  "linkedin.com",
  "glassdoor",
  "indeed",
  "shine.com",
  "naukri.com",
  "foundit",
  "ambitionbox",
];

export function isAlwaysBlockedDomain(urlOrDomain: string): boolean {
  const lower = urlOrDomain.toLowerCase();
  try {
    const rawUrl = /^https?:\/\//i.test(urlOrDomain) ? urlOrDomain : `https://${urlOrDomain}`;
    const parsed = new URL(rawUrl);
    const isInfoparkJobs =
      (parsed.hostname === "infopark.in" || parsed.hostname.endsWith(".infopark.in")) &&
      parsed.pathname.startsWith("/jobs");
    // Infopark's Kerala job pages are ordinary public HTML pages and remain eligible.
    if (isInfoparkJobs) return false;
  } catch {
    // Fall through to the known blocked-domain check for malformed URLs.
  }
  return ALWAYS_BLOCKED_SCRAPE_DOMAINS.some((blocked) => lower.includes(blocked));
}

/**
 * Strips HTML tags, script, style, navigation, etc., returning clean text excerpt (bounded to maxChars).
 */
export function sanitizeHtmlToText(html: string, maxChars = 8000): string {
  let cleaned = html;
  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, " ");
  // Remove script and style tags and their contents
  cleaned = cleaned.replace(/<(script|style|svg|noscript|header|footer|nav)[\s\S]*?<\/\1>/gi, " ");
  // Replace <br>, <p>, <div>, <li>, <h1>-<h6> with newlines
  cleaned = cleaned.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  cleaned = cleaned.replace(/<(br|hr)\s*\/?>/gi, "\n");
  // Remove all other HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

  // Normalize whitespace
  cleaned = cleaned
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return cleaned.slice(0, maxChars);
}

/**
 * Performs safe fetching of public HTTP/HTTPS URLs with:
 * - 8s timeout
 * - 1 MiB size cap
 * - At most 3 redirects
 * - Public DNS pin checking
 * - text/html or text/plain only
 */
export async function safeFetchUrl(
  initialUrl: string,
  options: {
    maxRedirects?: number;
    timeoutMs?: number;
    maxBytes?: number;
    maxTextChars?: number;
  } = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBytes = options.maxBytes ?? 1024 * 1024; // 1 MiB
  const maxTextChars = options.maxTextChars ?? 8000;

  let currentUrl = initialUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const parsed = validateUrl(currentUrl);
    const verifiedIps = await resolveAndValidateHostname(parsed.hostname);
    const targetIp = verifiedIps[0];

    const result = await new Promise<
      | { type: "redirect"; target: string }
      | { type: "response"; statusCode: number; text: string; length: number }
    >((resolve, reject) => {
      const isHttps = parsed.protocol === "https:";
      const port = parsed.port ? parseInt(parsed.port, 10) : isHttps ? 443 : 80;

      const reqOptions: https.RequestOptions = {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        },
        // Pin DNS lookup to the verified public IP address to prevent DNS rebinding
        lookup: (_hostname, opts, callback) => {
          const cb = typeof opts === "function" ? opts : callback;
          const options = typeof opts === "object" ? opts : {};
          const family = targetIp.includes(":") ? 6 : 4;
          if (options?.all) {
            cb(null, [{ address: targetIp, family }]);
          } else {
            cb(null, targetIp, family);
          }
        },
      };

      const client = isHttps ? https : http;
      let totalBytes = 0;
      let rawChunks: Buffer[] = [];
      let isTimedOut = false;

      const req = client.request(reqOptions, (res) => {
        const statusCode = res.statusCode || 200;

        // Check redirects (301, 302, 303, 307, 308) - up to 3 redirects
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          res.resume(); // discard body
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          resolve({ type: "redirect", target: nextUrl });
          return;
        }

        // Check for blocked/refused pages (Cloudflare, bot protection, 401, 403, 429)
        if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
          res.resume();
          reject(
            new SafeFetchError(
              `Target page refused access (HTTP ${statusCode}).`,
              "blocked_page"
            )
          );
          return;
        }

        if (statusCode >= 400) {
          res.resume();
          reject(
            new SafeFetchError(
              `Target page returned HTTP ${statusCode}.`,
              "http_error"
            )
          );
          return;
        }

        // Verify content-type (HTML only)
        const contentType = (res.headers["content-type"] || "").toLowerCase();
        if (
          !contentType.includes("text/html") &&
          !contentType.includes("application/xhtml+xml")
        ) {
          res.resume();
          reject(
            new SafeFetchError(
              `Unsupported Content-Type: ${contentType || "unknown"}. Only HTML pages are permitted.`,
              "unsupported_content_type"
            )
          );
          return;
        }

        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy(new SafeFetchError("Response exceeded 1 MiB limit.", "size_limit_exceeded"));
            return;
          }
          rawChunks.push(chunk);
        });

        res.on("end", () => {
          const body = Buffer.concat(rawChunks).toString("utf-8");
          const text = sanitizeHtmlToText(body, maxTextChars);
          resolve({
            type: "response",
            statusCode,
            text,
            length: totalBytes,
          });
        });
      });

      req.on("error", (err: any) => {
        if (isTimedOut) {
          reject(new SafeFetchError("Fetch timed out after 8 seconds.", "timeout"));
        } else {
          reject(new SafeFetchError(`Network error: ${err.message}`, "network_error"));
        }
      });

      req.setTimeout(timeoutMs, () => {
        isTimedOut = true;
        req.destroy(new SafeFetchError("Fetch timed out after 8 seconds.", "timeout"));
      });

      req.end();
    });

    if (result.type === "redirect") {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new SafeFetchError("Maximum redirects (3) exceeded.", "too_many_redirects");
      }
      currentUrl = result.target;
      continue;
    }

    return {
      url: initialUrl,
      finalUrl: currentUrl,
      statusCode: result.statusCode,
      text: result.text,
      contentLength: result.length,
    };
  }

  throw new SafeFetchError("Maximum redirects exceeded.", "too_many_redirects");
}
