import { SerpApiOrganicResult } from "../providers/serpapi";
import { SafeFetchResult, isAlwaysBlockedDomain } from "../safe-fetch";
import { fetchWithJinaReader } from "../providers/jina";

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
        const page = await fetchWithJinaReader(item.link, {
          timeoutMs: 8000,
          maxTextChars: 8000,
        });
        return { item, page };
      } catch {
        return { item, page: null };
      }
    })
  );
}
