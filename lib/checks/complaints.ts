import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
  Signal,
} from "../contracts";
import { searchGoogleWithSerpApi, SerpApiError } from "../providers/serpapi";
import { safeFetchUrl } from "../safe-fetch";

const COMPLAINT_KEYWORDS = [
  "scam",
  "fraud",
  "fake",
  "complaint",
  "cheated",
  "money taken",
  "registration fee",
  "fake job",
  "offer letter scam",
];

/**
 * Check 5: complaints
 * Searches for recruiting and payment complaints across independent sources.
 */
export async function checkComplaints(
  claims: ExtractedClaims,
  analysisDate = new Date()
): Promise<CheckResult> {
  const now = analysisDate.toISOString();
  const company = claims.companyName?.trim() || "";

  if (!company) {
    return {
      id: "complaints",
      status: "inconclusive",
      reasonCode: "missing_data",
      reason: "No company name was available to perform complaints search.",
      finding: "Cannot search for complaints or reviews without a company name.",
      whyItMatters:
        "Public scam complaints alert candidates to recurring fraudulent recruitment schemes.",
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

  // Construct query: company + (scam OR complaint OR review)
  const query = `${company} (scam OR complaint OR review)`;

  let searchResults: Awaited<ReturnType<typeof searchGoogleWithSerpApi>> = [];
  try {
    searchResults = await searchGoogleWithSerpApi(query, 15000);
  } catch (err: any) {
    const reasonCode = (err instanceof SerpApiError ? err.code : "provider_error") as ReasonCode;
    return {
      id: "complaints",
      status: "unavailable",
      reasonCode,
      reason: err.message || "Failed to query complaints sources.",
      finding: `Complaints check unavailable: ${err.message}`,
      whyItMatters:
        "Public reviews and scam alerts help identify ongoing recruitment fraud patterns.",
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
  const signals: Signal[] = [];

  // Filter relevant items that mention both company and scam/complaint keywords
  const relevantResults = searchResults.filter((item) => {
    const text = `${item.title} ${item.snippet || ""}`.toLowerCase();
    const hasCompany = text.includes(company.toLowerCase());
    const hasKeywords = COMPLAINT_KEYWORDS.some((kw) => text.includes(kw));
    return hasCompany && hasKeywords;
  });

  if (relevantResults.length === 0) {
    return {
      id: "complaints",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: "No relevant complaints found in the sources checked.",
      whyItMatters:
        "Lack of complaints in initial search sources is contextual and not a guarantee of safety.",
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
        identityMatch: "high",
      },
    };
  }

  // Read at most 2 relevant pages to inspect allegation specifics and deduplicate
  const independentSources = new Map<string, string>(); // domain -> quote
  let pagesRead = 0;

  for (const item of relevantResults) {
    if (pagesRead >= 2) break;

    let itemDomain = "search_result";
    try {
      itemDomain = new URL(item.link).hostname;
    } catch {}

    evidenceList.push({
      id: `ev-comp-snip-${pagesRead + 1}`,
      kind: "search_snippet",
      title: item.title,
      url: item.link,
      quote: item.snippet || null,
      provider: "SerpAPI",
      publishedAt: null,
      retrievedAt: now,
      classification: "allegation",
    });

    try {
      const page = await safeFetchUrl(item.link, {
        timeoutMs: 8000,
        maxBytes: 1024 * 512,
        maxRedirects: 3,
        maxTextChars: 8000,
      });
      pagesRead++;

      const pageLower = page.text.toLowerCase();
      const mentionsRecruitingScam = COMPLAINT_KEYWORDS.some((kw) => pageLower.includes(kw));

      if (mentionsRecruitingScam && !independentSources.has(itemDomain)) {
        independentSources.set(itemDomain, page.text.slice(0, 250));
        evidenceList.push({
          id: `ev-comp-page-${pagesRead}`,
          kind: "page",
          title: item.title,
          url: item.link,
          quote: page.text.slice(0, 250),
          provider: "web_read",
          publishedAt: null,
          retrievedAt: now,
          classification: "allegation",
        });
      }
    } catch {
      // Snippet remains recorded
      if (!independentSources.has(itemDomain) && item.snippet) {
        independentSources.set(itemDomain, item.snippet);
      }
    }
  }

  // Emit complaint_pattern (20 pts) ONLY if 2+ independent, relevant sources report concerns
  if (independentSources.size >= 2) {
    signals.push({
      code: "complaint_pattern",
      points: 20,
      evidenceIds: evidenceList.map((e) => e.id),
      explanation: `Discovered a pattern of reported recruitment/payment allegations across ${independentSources.size} independent sources concerning ${company}.`,
    });

    return {
      id: "complaints",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: `Multiple independent sources report recruitment complaints or scam allegations regarding "${company}".`,
      whyItMatters:
        "Multiple independent reports indicate a recurring pattern of recruitment or payment complaints.",
      checkedAt: now,
      evidence: evidenceList,
      signals,
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

  // Only 1 source or inconclusive corroboration
  return {
    id: "complaints",
    status: "inconclusive",
    reasonCode: "ambiguous_identity",
    reason: "Found isolated or unverified mentions, but could not establish 2+ independent relevant complaint sources.",
    finding: `Isolated mention found regarding "${company}", but insufficient independent corroboration to confirm a complaint pattern.`,
    whyItMatters:
      "A complaint pattern requires multiple independent corroborating sources rather than a single allegation.",
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
      cin: null,
      identityMatch: "ambiguous",
    },
  };
}
