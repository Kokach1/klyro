import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
  Signal,
} from "../contracts";
import { searchGoogleWithSerpApi, SerpApiError } from "../providers/serpapi";
import { safeFetchUrl } from "../safe-fetch";

/**
 * Check 3: careers_match
 * Discovers and inspects official careers pages to verify the advertised job posting.
 */
export async function checkCareersMatch(
  claims: ExtractedClaims,
  analysisDate = new Date()
): Promise<CheckResult> {
  const now = analysisDate.toISOString();
  const company = claims.companyName?.trim() || "";
  const role = claims.role?.trim() || "";
  const location = claims.location?.trim() || "";
  const domain = claims.employerDomain?.trim() || null;

  if (!company && !role) {
    return {
      id: "careers_match",
      status: "inconclusive",
      reasonCode: "missing_data",
      reason: "Missing company name and role to search careers portal.",
      finding: "Cannot search official careers portal without company name or role.",
      whyItMatters:
        "Matching a job post to the official careers site confirms genuine hiring authority.",
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

  // Construct query: company + role + location + careers/jobs
  // Use known employer domain in site: if available
  let query = "";
  if (domain) {
    query = `site:${domain} ${role || company} careers jobs`;
  } else {
    const parts = [company, role, location, "careers jobs"].filter(Boolean);
    query = parts.join(" ");
  }

  let searchResults: Awaited<ReturnType<typeof searchGoogleWithSerpApi>> = [];
  try {
    searchResults = await searchGoogleWithSerpApi(query, 15000);
  } catch (err: any) {
    const reasonCode = (err instanceof SerpApiError ? err.code : "provider_error") as ReasonCode;
    return {
      id: "careers_match",
      status: "unavailable",
      reasonCode,
      reason: err.message || "Failed to search careers sources.",
      finding: `Careers search unavailable: ${err.message}`,
      whyItMatters:
        "Verifying the posting directly on the employer's official jobs portal confirms legitimacy.",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: {
        domain,
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

  if (searchResults.length === 0) {
    signals.push({
      code: "careers_not_found",
      points: 10,
      evidenceIds: [],
      explanation: "No careers portal or vacancy listings were discovered in Google search results.",
    });

    return {
      id: "careers_match",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: "No matching role found in the sources checked. It may be expired, unlisted or inaccessible.",
      whyItMatters:
        "Legitimate postings typically link to or appear on the employer's official website or established careers portal.",
      checkedAt: now,
      evidence: [],
      signals,
      facts: {
        domain,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: false,
        legalName: null,
        cin: null,
        identityMatch: "none",
      },
    };
  }

  // Bounded reading: read at most 2 relevant candidate pages
  let pagesRead = 0;
  let matchingPageFound = false;
  let confirmedDomain = false;

  for (const item of searchResults) {
    if (pagesRead >= 2) break;

    // Record search snippet lead
    evidenceList.push({
      id: `ev-car-snip-${pagesRead + 1}`,
      kind: "search_snippet",
      title: item.title,
      url: item.link,
      quote: item.snippet || null,
      provider: "SerpAPI",
      publishedAt: null,
      retrievedAt: now,
      classification: "unknown",
    });

    // Try reading page safely
    try {
      const pageResult = await safeFetchUrl(item.link, {
        timeoutMs: 8000,
        maxBytes: 1024 * 512,
        maxRedirects: 3,
        maxTextChars: 8000,
      });
      pagesRead++;

      const pageTextLower = pageResult.text.toLowerCase();
      const roleLower = role.toLowerCase();
      const companyLower = company.toLowerCase();

      // Check if role and company match on this page
      const hasRole = roleLower && pageTextLower.includes(roleLower);
      const hasCompany = companyLower ? pageTextLower.includes(companyLower) : true;

      if (hasRole && hasCompany) {
        matchingPageFound = true;
        if (domain && item.link.includes(domain)) {
          confirmedDomain = true;
        }

        evidenceList.push({
          id: `ev-car-page-${pagesRead}`,
          kind: "page",
          title: item.title,
          url: item.link,
          quote: pageResult.text.slice(0, 300),
          provider: "web_read",
          publishedAt: null,
          retrievedAt: now,
          classification: "corroboration",
        });
        break;
      }
    } catch {
      // Page read failed or blocked; snippet lead remains recorded
    }
  }

  if (matchingPageFound) {
    return {
      id: "careers_match",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: `Verified matching job posting found on official careers portal (${role} at ${company || "employer"}).`,
      whyItMatters:
        "Matching an advertised role on the official careers portal provides strong corroboration of legitimate recruiting.",
      checkedAt: now,
      evidence: evidenceList,
      signals: [],
      facts: {
        domain,
        domainOfficialConfirmed: confirmedDomain,
        domainResponse: "responds",
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: true,
        legalName: null,
        cin: null,
        identityMatch: "high",
      },
    };
  }

  // If we read pages but found no matching vacancy
  if (pagesRead > 0) {
    signals.push({
      code: "careers_not_found",
      points: 10,
      evidenceIds: evidenceList.map((e) => e.id),
      explanation: `Searched and read careers results but did not locate a matching listing for "${role}". Vacancy may be unlisted, filled, or third-party only.`,
    });

    return {
      id: "careers_match",
      status: "completed",
      reasonCode: null,
      reason: null,
      finding: "No matching role found in the sources checked. It may be expired, unlisted or inaccessible.",
      whyItMatters:
        "Fraudulent postings often invent vacancies that do not exist in the employer's official hiring system.",
      checkedAt: now,
      evidence: evidenceList,
      signals,
      facts: {
        domain,
        domainOfficialConfirmed: false,
        domainResponse: null,
        domainCreatedAt: null,
        domainAgeDays: null,
        domainYoung: null,
        roleMatched: false,
        legalName: null,
        cin: null,
        identityMatch: "ambiguous",
      },
    };
  }

  // Only snippets available, pages couldn't be read
  return {
    id: "careers_match",
    status: "inconclusive",
    reasonCode: "blocked_page",
    reason: "Candidate pages could not be accessed directly; search snippets alone are inconclusive.",
    finding: "Search discovered candidate results but individual pages could not be verified directly.",
    whyItMatters:
      "A search snippet is a discovery lead rather than verified proof of an active job listing.",
    checkedAt: now,
    evidence: evidenceList,
    signals: [],
    facts: {
      domain,
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
