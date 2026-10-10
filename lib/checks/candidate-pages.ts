import { SerpApiOrganicResult } from "../providers/serpapi";
import { SafeFetchResult, isAlwaysBlockedDomain, safeFetchUrl } from "../safe-fetch";

export const MAX_CANDIDATE_PAGES = 3;

export interface CandidatePageResult {
  item: SerpApiOrganicResult;
  page: SafeFetchResult | null;
}

export function selectCandidatePages(
  results: SerpApiOrganicResult[],
  skipAdditional?: (url: string) => boolean
): SerpApiOrganicResult[] {
  return results
    .filter((item) => !isAlwaysBlockedDomain(item.link))
    .filter((item) => !skipAdditional?.(item.link))
    .slice(0, MAX_CANDIDATE_PAGES);
}

export async function fetchCandidatePages(
  candidates: SerpApiOrganicResult[]
): Promise<CandidatePageResult[]> {
  return Promise.all(
    candidates.map(async (item) => {
      try {
        const page = await safeFetchUrl(item.link, {
          timeoutMs: 8000,
          maxBytes: 1024 * 512,
          maxRedirects: 3,
          maxTextChars: 8000,
        });
        return { item, page };
      } catch {
        return { item, page: null };
      }
    })
  );
}
