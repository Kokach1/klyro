import crypto from "crypto";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const extractLimits = new Map<string, RateLimitEntry>();
const verifyLimits = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of extractLimits.entries()) {
    if (v.resetAt <= now) extractLimits.delete(k);
  }
  for (const [k, v] of verifyLimits.entries()) {
    if (v.resetAt <= now) verifyLimits.delete(k);
  }
}, 60000).unref();

/**
 * Anonymizes the client identifier without logging raw IP addresses.
 */
function hashClientIdentifier(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 16);
}

/**
 * Best-effort in-memory rate limiter:
 * 5 extract and 5 verify requests per IP per minute.
 */
export function checkRateLimit(
  reqType: "extract" | "verify",
  clientIdentifier: string,
  limit = 5,
  windowMs = 60000
): { allowed: boolean; remaining: number } {
  const store = reqType === "extract" ? extractLimits : verifyLimits;
  const hash = hashClientIdentifier(clientIdentifier || "unknown-client");
  const now = Date.now();

  const entry = store.get(hash);
  if (!entry || entry.resetAt <= now) {
    store.set(hash, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
