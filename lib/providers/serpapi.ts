import { getServerEnv } from "../env";

export interface SerpApiOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  displayed_link?: string;
  position?: number;
}

export class SerpApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SerpApiError";
  }
}

/**
 * Executes a search query using SerpAPI (engine=google, gl=in, hl=en).
 * Defensive against malformed responses and errors on HTTP 200.
 * Strips any sensitive provider links or credentials from results.
 */
export async function searchGoogleWithSerpApi(
  query: string,
  timeoutMs = 15000
): Promise<SerpApiOrganicResult[]> {
  const env = getServerEnv();
  const apiKey = env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new SerpApiError("SERPAPI_API_KEY is not configured on the server.", "missing_key");
  }

  const searchUrl = new URL("https://serpapi.com/search");
  searchUrl.searchParams.set("engine", "google");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("api_key", apiKey);
  searchUrl.searchParams.set("output", "json");
  searchUrl.searchParams.set("gl", "in");
  searchUrl.searchParams.set("hl", "en");

  let response: Response;
  try {
    response = await fetch(searchUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      throw new SerpApiError("SerpAPI request timed out.", "timeout");
    }
    throw new SerpApiError(`Network error connecting to SerpAPI: ${err.message}`, "provider_error");
  }

  if (response.status === 401 || response.status === 403) {
    throw new SerpApiError("SerpAPI authentication failed (invalid key).", "missing_key");
  }

  if (response.status === 429) {
    throw new SerpApiError("SerpAPI rate limit or quota exceeded.", "quota");
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err: any) {
    throw new SerpApiError("Malformed JSON response from SerpAPI.", "provider_error");
  }

  // Validate errors even on HTTP 200
  if (data.error) {
    const errorMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (
      errorMsg.includes("run out of searches") ||
      errorMsg.includes("Monthly limit") ||
      errorMsg.includes("quota")
    ) {
      throw new SerpApiError(`SerpAPI quota exceeded: ${errorMsg}`, "quota");
    }
    throw new SerpApiError(`SerpAPI error: ${errorMsg}`, "provider_error");
  }

  const rawOrganic = data.organic_results;
  if (!Array.isArray(rawOrganic)) {
    return [];
  }

  // Filter and sanitize results (never expose serpapi_link or keys)
  const results: SerpApiOrganicResult[] = [];
  for (const item of rawOrganic) {
    if (item && item.link && typeof item.link === "string") {
      // Ensure the link is a valid public HTTP(S) URL
      if (item.link.startsWith("http://") || item.link.startsWith("https://")) {
        results.push({
          title: String(item.title || "Search result"),
          link: item.link,
          snippet: item.snippet ? String(item.snippet) : undefined,
          displayed_link: item.displayed_link ? String(item.displayed_link) : undefined,
          position: typeof item.position === "number" ? item.position : undefined,
        });
      }
    }
  }

  return results;
}
