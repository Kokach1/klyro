import { getServerEnv } from "../env";
import {
  BROWSER_USER_AGENT,
  SafeFetchResult,
  sanitizeHtmlToText,
  validateUrl,
} from "../safe-fetch";

export const JINA_READER_BASE_URL = "https://r.jina.ai/";

export interface JinaReaderOptions {
  timeoutMs?: number;
  maxTextChars?: number;
}

/**
 * Routes outbound page reads through Jina Reader (https://r.jina.ai/<url>).
 * - No API key is required for the free tier.
 * - If JINA_API_KEY is configured in the environment, sends `Authorization: Bearer <key>`.
 * - Applies untrusted-content sanitization and text clamping (default 8,000 chars).
 */
export async function fetchWithJinaReader(
  targetUrl: string,
  options: JinaReaderOptions = {}
): Promise<SafeFetchResult | null> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxTextChars = options.maxTextChars ?? 8000;

  let cleanTarget = targetUrl.trim();
  if (!cleanTarget) return null;

  // Validate the target URL format and scheme
  try {
    validateUrl(cleanTarget);
  } catch {
    return null;
  }

  const jinaUrl = cleanTarget.startsWith(JINA_READER_BASE_URL)
    ? cleanTarget
    : `${JINA_READER_BASE_URL}${cleanTarget}`;

  const env = getServerEnv();
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "text/plain",
    "X-No-Cache": "true",
  };

  if (env.JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(jinaUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const rawBody = await response.text();
    if (!rawBody || rawBody.trim().length === 0) {
      return null;
    }

    // Treat returned text as untrusted content; sanitize HTML / markdown artifacts and clamp length
    const text = sanitizeHtmlToText(rawBody, maxTextChars);

    return {
      url: cleanTarget,
      finalUrl: cleanTarget,
      statusCode: response.status,
      text,
      contentLength: text.length,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
