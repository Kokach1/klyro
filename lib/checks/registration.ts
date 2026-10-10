import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
} from "../contracts";
import { searchGoogleWithSerpApi, SerpApiError } from "../providers/serpapi";
import { isAlwaysBlockedDomain } from "../safe-fetch";
import { fetchCandidatePages, selectCandidatePages } from "./candidate-pages";
import { buildCompanySearchQuery } from "./search-query";

// Standard 21-character Indian Corporate Identification Number pattern
const CIN_REGEX = /[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}/i;

// Registry sources prioritized for Indian corporate registration
export const PREFERRED_REGISTRY_DOMAINS = [
  "mca.gov.in",
  "zaubacorp",
  "thecompanycheck",
  "vakilsearch",
  "tofler",
  "instafinancials",
];

/**
 * Priority rank for registration check search results:
 * 1. mca.gov.in (official ministry registry - snippet corroboration)
 * 2. zaubacorp, thecompanycheck, vakilsearch (trusted company databases)
 * 3. tofler, instafinancials
 * 10. other sources
 * 99. skip-list aggregators (linkedin, indeed, glassdoor, naukri, etc.)
 */
export function getRegistryPriority(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes("mca.gov.in")) return 1;
  if (
    lower.includes("zaubacorp") ||
    lower.includes("thecompanycheck") ||
    lower.includes("vakilsearch")
  ) {
    return 2;
  }
  if (lower.includes("tofler") || lower.includes("instafinancials")) {
    return 3;
  }
  if (isAlwaysBlockedDomain(url)) {
    return 99;
  }
  return 10;
}

/**
 * Checks whether snippet or page text matches company name, accounting for common corporate suffixes.
 */
export function matchesLegalName(targetText: string, companyName: string): boolean {
  if (!targetText || !companyName) return false;
  const normTarget = targetText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const normCompany = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (!normTarget || !normCompany) return false;

  // Direct substring match
  if (normTarget.includes(normCompany)) return true;

  // Compare stem without corporate suffixes (private limited, pvt ltd, limited, etc.)
  const stem = normCompany
    .replace(/\b(private limited|pvt ltd|private ltd|limited|ltd|inc|llp|corp|corporation)\b/g, "")
    .trim();

  if (stem.length >= 3 && normTarget.includes(stem)) {
    return true;
  }

  return false;
}

/**
 * Extracts candidate legal entity name from a registry result title or snippet.
 */
export function extractCandidateLegalName(title: string, company: string): string {
  if (!title) return company;
  const segment = title.split(/[-|–]/)[0]?.trim();
  if (segment && matchesLegalName(segment, company)) {
    return segment;
  }
  return company;
}

/**
 * Check 4: registration
 * Verifies Indian business registration (MCA/CIN leads) via official or corporate registry sources.
 */
export async function checkRegistration(
  claims: ExtractedClaims,
  analysisDate = new Date()
): Promise<CheckResult> {
  const now = analysisDate.toISOString();
  const company = claims.companyName?.trim() || "";
  const location = claims.location?.toLowerCase().trim() || "";

  if (!company) {
    return {
      id: "registration",
      status: "inconclusive",
      reasonCode: "missing_data",
      reason: "No company name was extracted to check corporate registration.",
      finding: "Cannot perform company registration check without a company name.",
      whyItMatters:
        "Corporate registry records corroborate legal existence and registered office location.",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: {
        domain: null,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: null,
        legalName: null,
        cin: null,
        identityMatch: "ambiguous",
      },
    };
  }

  // Check if known non-Indian company
  const isForeignLocation =
    location.includes("usa") ||
    location.includes("united states") ||
    location.includes("uk") ||
    location.includes("london") ||
    location.includes("canada") ||
    location.includes("germany") ||
    location.includes("australia");

  if (isForeignLocation && !location.includes("india")) {
    return {
      id: "registration",
      status: "not_applicable",
      reasonCode: "not_indian_company",
      reason: `Posting location is specified outside India (${claims.location}); Indian MCA registration does not apply.`,
      finding: "Indian MCA registration is not applicable for this foreign entity.",
      whyItMatters:
        "The registration check verifies Indian Corporate Identification Numbers (CIN).",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: {
        domain: null,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: null,
        legalName: null,
        cin: null,
        identityMatch: "not_applicable",
      },
    };
  }

  const query = buildCompanySearchQuery(company, "private limited CIN registration");

  let searchResults: Awaited<ReturnType<typeof searchGoogleWithSerpApi>> = [];
  try {
    searchResults = await searchGoogleWithSerpApi(query, 7000);
  } catch (err: any) {
    const reasonCode = (err instanceof SerpApiError ? err.code : "provider_error") as ReasonCode;
    return {
      id: "registration",
      status: "unavailable",
      reasonCode,
      reason: err.message || "Failed to query company registration search.",
      finding: `Registration check unavailable: ${err.message}`,
      whyItMatters:
        "Confirming business registration validates that an organization is a recognized legal entity.",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: {
        domain: null,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: null,
        legalName: null,
        cin: null,
        identityMatch: "ambiguous",
      },
    };
  }

  if (searchResults.length === 0) {
    return {
      id: "registration",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: `No public company registration or CIN found for "${company}" in sources checked.`,
      whyItMatters:
        "Absence of a CIN does not prove fraud; many startups, sole proprietorships, and partnerships operate without a CIN.",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: {
        domain: null,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: null,
        legalName: null,
        cin: null,
        identityMatch: "none",
      },
    };
  }

  const evidenceList: Evidence[] = [];
  let discoveredCin: string | null = null;
  let discoveredLegalName: string | null = null;
  let identityMatch: "high" | "ambiguous" | "none" | "not_applicable" = "ambiguous";

  // Prioritize search results: MCA -> ZaubaCorp/TheCompanyCheck/Vakilsearch -> other -> skip-list last
  const prioritizedResults = [...searchResults].sort(
    (a, b) => getRegistryPriority(a.link) - getRegistryPriority(b.link)
  );

  for (const item of prioritizedResults) {
    const combinedSnippetText = `${item.title} ${item.snippet || ""}`;

    // Extract CIN from snippet or title
    const snippetCinMatch = CIN_REGEX.exec(combinedSnippetText);
    const snippetCin = snippetCinMatch ? snippetCinMatch[0].toUpperCase() : null;

    // Snippets carry CIN - treat snippet CIN + exact legal name as corroboration since MCA blocks direct fetch
    if (snippetCin && matchesLegalName(combinedSnippetText, company)) {
      discoveredCin = snippetCin;
      discoveredLegalName = extractCandidateLegalName(item.title, company);
      identityMatch = "high";

      evidenceList.push({
        id: `ev-reg-snip-${evidenceList.length + 1}`,
        kind: "search_snippet",
        title: item.title,
        url: item.link,
        quote: item.snippet || item.title,
        provider: "SerpAPI",
        publishedAt: null,
        retrievedAt: now,
        classification: "corroboration",
      });

      break;
    }

    evidenceList.push({
      id: `ev-reg-snip-${evidenceList.length + 1}`,
      kind: "search_snippet",
      title: item.title,
      url: item.link,
      quote: item.snippet || null,
      provider: "SerpAPI",
      publishedAt: null,
      retrievedAt: now,
      classification: "unknown",
    });

    // Check if snippet contains a CIN lead for ambiguous records
    if (!discoveredCin && snippetCin) {
      discoveredCin = snippetCin;
    }
  }

  if (identityMatch === "high" && discoveredCin) {
    return {
      id: "registration", status: "completed", reasonCode: null, reason: null,
      finding: `Found matching registered entity: ${discoveredLegalName || company} (CIN: ${discoveredCin}).`,
      whyItMatters: "Corroborating a registered corporate entity verifies that a legal company exists in registry records.",
      checkedAt: now, evidence: evidenceList, signals: [],
      facts: { domain: null, domainOfficialConfirmed: false, domainResponse: null, domainCreatedAt: null, domainAgeDays: null, domainYoung: null, roleMatched: null, legalName: discoveredLegalName || company, cin: discoveredCin, identityMatch: "high" },
    };
  }

  const candidates = selectCandidatePages(prioritizedResults, (url) => url.toLowerCase().includes("mca.gov.in"));
  if (candidates.length === 0) {
    return {
      id: "registration", status: "inconclusive", reasonCode: "blocked_page",
      reason: "No registry candidate pages passed the domain filter.",
      finding: `Registry search returned no fetchable sources for "${company}".`,
      whyItMatters: "A search result without accessible registry evidence cannot confirm a legal entity.",
      checkedAt: now, evidence: evidenceList, signals: [],
      facts: { domain: null, domainOfficialConfirmed: false, domainResponse: null, domainCreatedAt: null, domainAgeDays: null, domainYoung: null, roleMatched: null, legalName: null, cin: discoveredCin, identityMatch: "ambiguous" },
    };
  }

  const fetchedCandidates = await fetchCandidatePages(candidates);
  for (const { item, page } of fetchedCandidates) {
    if (page) {
      const cinMatch = CIN_REGEX.exec(page.text);
      if (cinMatch) {
        discoveredCin = cinMatch[0].toUpperCase();
      }

      if (matchesLegalName(page.text, company)) {
        discoveredLegalName = extractCandidateLegalName(item.title, company);
        identityMatch = "high";

        evidenceList.push({
          id: `ev-reg-page-${evidenceList.length + 1}`,
          kind: "registry",
          title: item.title,
          url: item.link,
          quote: page.text.slice(0, 300),
          provider: "registry_read",
          publishedAt: null,
          retrievedAt: now,
          classification: "corroboration",
        });
      }
    }
  }

  if (identityMatch === "high" && discoveredCin) {
    return {
      id: "registration",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: `Found matching registered entity: ${discoveredLegalName || company} (CIN: ${discoveredCin}).`,
      whyItMatters:
        "Corroborating a registered corporate entity verifies that a legal company exists in registry records.",
      checkedAt: now,
      evidence: evidenceList,
      signals: [], // Positive records never subtract risk points
      facts: {
        domain: null,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: null,
        legalName: discoveredLegalName || company,
        cin: discoveredCin,
        identityMatch: "high",
      },
    };
  }

  // Snippets found but identity match is ambiguous
  return {
    id: "registration",
    status: "inconclusive",
    reasonCode: "ambiguous_identity",
    reason: "Discovered search leads were inconclusive; entity brand-to-CIN relationship could not be verified.",
    finding: `Registry lookup returned results for "${company}" but could not corroborate a specific legal entity match.`,
    whyItMatters:
      "A company name alone without corroborated registered address or domain does not establish legal entity identity.",
    checkedAt: now,
    evidence: evidenceList,
    signals: [],
    facts: {
      domain: null,
      domainOfficialConfirmed: false,
      domainResponse: null,
      domainCreatedAt: null,
      domainAgeDays: null,
      domainYoung: null,
      roleMatched: null,
      legalName: null,
      cin: discoveredCin,
      identityMatch: "ambiguous",
    },
  };
}
