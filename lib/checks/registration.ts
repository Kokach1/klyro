import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
} from "../contracts";
import { searchGoogleWithSerpApi, SerpApiError } from "../providers/serpapi";
import { safeFetchUrl } from "../safe-fetch";

// Standard 21-character Indian Corporate Identification Number pattern
const CIN_REGEX = /[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}/i;

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

  // One registration SerpAPI query discovers official MCA / company record sources
  const query = `${company} India CIN MCA company registration`;

  let searchResults: Awaited<ReturnType<typeof searchGoogleWithSerpApi>> = [];
  try {
    searchResults = await searchGoogleWithSerpApi(query, 15000);
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

  const evidenceList: Evidence[] = [];
  let discoveredCin: string | null = null;
  let discoveredLegalName: string | null = null;
  let identityMatch: "high" | "ambiguous" | "none" | "not_applicable" = "ambiguous";

  let pagesRead = 0;
  for (const item of searchResults) {
    if (pagesRead >= 2) break;

    evidenceList.push({
      id: `ev-reg-snip-${pagesRead + 1}`,
      kind: "search_snippet",
      title: item.title,
      url: item.link,
      quote: item.snippet || null,
      provider: "SerpAPI",
      publishedAt: null,
      retrievedAt: now,
      classification: "unknown",
    });

    // Check if snippet contains a CIN
    if (!discoveredCin && item.snippet) {
      const cinMatch = CIN_REGEX.exec(item.snippet);
      if (cinMatch) {
        discoveredCin = cinMatch[0].toUpperCase();
      }
    }

    // Try reading page to corroborate legal entity name and CIN
    try {
      const page = await safeFetchUrl(item.link, {
        timeoutMs: 8000,
        maxBytes: 1024 * 512,
        maxRedirects: 3,
        maxTextChars: 8000,
      });
      pagesRead++;

      const cinMatch = CIN_REGEX.exec(page.text);
      if (cinMatch) {
        discoveredCin = cinMatch[0].toUpperCase();
      }

      if (page.text.toLowerCase().includes(company.toLowerCase())) {
        discoveredLegalName = item.title.split("-")[0]?.split("|")[0]?.trim() || company;
        identityMatch = "high";

        evidenceList.push({
          id: `ev-reg-page-${pagesRead}`,
          kind: "registry",
          title: item.title,
          url: item.link,
          quote: page.text.slice(0, 300),
          provider: "registry_read",
          publishedAt: null,
          retrievedAt: now,
          classification: "corroboration",
        });
        break;
      }
    } catch {
      // Ignore page fetch errors; snippets remain recorded
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
      signals: [], // Never emit scam signal merely because CIN was not found
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
