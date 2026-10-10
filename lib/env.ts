/**
 * Server-only environment variables accessor.
 * Never import or use these on the client side.
 */

export interface AppEnv {
  OPENAI_API_KEY?: string;
  SERPAPI_API_KEY?: string;
  WHOISXML_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENCORPORATES_API_KEY?: string;
}

export function getServerEnv(): AppEnv {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() || undefined,
    // Accept SERPAPI_API_KEY as primary, SERPAPI_KEY as fallback per spec
    SERPAPI_API_KEY: (
      process.env.SERPAPI_API_KEY?.trim() ||
      process.env.SERPAPI_KEY?.trim() ||
      undefined
    ),
    // Accept WHOISXML_API_KEY as primary, WHOISXML_KEY as fallback per spec
    WHOISXML_API_KEY: (
      process.env.WHOISXML_API_KEY?.trim() ||
      process.env.WHOISXML_KEY?.trim() ||
      undefined
    ),
    OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || undefined,
    OPENCORPORATES_API_KEY: process.env.OPENCORPORATES_API_KEY?.trim() || undefined,
  };
}
