/**
 * Server-only environment variables accessor.
 * Never import or use these on the client side.
 */

export interface AppEnv {
  GEMINI_API_KEYS: string[];
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
  SERPAPI_API_KEY?: string;
  WHOISXML_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENCORPORATES_API_KEY?: string;
}

function extractApiKeyFromPossibleUrl(keyRaw?: string): string | undefined {
  if (!keyRaw) return undefined;
  const trimmed = keyRaw.trim();
  if (trimmed.includes("apiKey=")) {
    try {
      const parsed = new URL(trimmed);
      const param = parsed.searchParams.get("apiKey");
      if (param) return param.trim();
    } catch {
      const match = trimmed.match(/apiKey=([^&]+)/);
      if (match) return match[1].trim();
    }
  }
  return trimmed;
}

export function getServerEnv(): AppEnv {
  const geminiKeysRaw =
    process.env.GEMINI_API_KEYS?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";

  const geminiKeys = geminiKeysRaw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  return {
    GEMINI_API_KEYS: geminiKeys,
    GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() || undefined,
    // Accept SERPAPI_API_KEY as primary, SERPAPI_KEY as fallback per spec
    SERPAPI_API_KEY: (
      process.env.SERPAPI_API_KEY?.trim() ||
      process.env.SERPAPI_KEY?.trim() ||
      undefined
    ),
    // Accept WHOISXML_API_KEY as primary, WHOISXML_KEY as fallback per spec
    WHOISXML_API_KEY: extractApiKeyFromPossibleUrl(
      process.env.WHOISXML_API_KEY?.trim() ||
      process.env.WHOISXML_KEY?.trim() ||
      undefined
    ),
    OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || undefined,
    OPENCORPORATES_API_KEY: process.env.OPENCORPORATES_API_KEY?.trim() || undefined,
  };
}
