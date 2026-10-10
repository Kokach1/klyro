import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
  Signal,
} from "../contracts";
import { searchGoogleWithSerpApi, SerpApiError } from "../providers/serpapi";
import { isAlwaysBlockedDomain } from "../safe-fetch";
import { fetchCandidatePages, selectCandidatePages } from "./candidate-pages";
import { buildCompanySearchQuery } from "./search-query";

// Employer-linked ATS portals per specification
export const EMPLOYER_ATS_DOMAINS = [
  "lever.co",
  "greenhouse.io",
  "workday.com",
  "myworkdayjobs.com",
  "keka.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "bamboohr.com",
  "jobvite.com",
  "infopark.in",
];

/**
 * Priority rank for candidate careers pages:
 * 1. Employer's own domain
 * 2. Employer-linked portals (lever.co, greenhouse.io, workday, keka, etc.)
 * 3. Other domains
 * 4. Aggregators / skip-list (linkedin, indeed, glassdoor, naukri, etc.)
 */
export function getCareersPagePriority(url: string, employerDomain: string | null): number {
  const lowerUrl = url.toLowerCase();

  // 1. Employer's own domain
  if (employerDomain) {
    const cleanEmp = employerDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    if (cleanEmp && lowerUrl.includes(cleanEmp)) {
      return 1;
    }
  }

  // 2. Employer-linked portals (lever.co, greenhouse.io, workday, keka)
  if (EMPLOYER_ATS_DOMAINS.some((ats) => lowerUrl.includes(ats))) {
    return 2;
  }

  // 4. Aggregators / blocked domains last
  if (isAlwaysBlockedDomain(url)) {
    return 4;
  }

  // 3. Other domains
  return 3;
}

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
  const domain = claims.employerDomain?.trim() || null;

  if (!company) {
    return {
      id: "careers_match",
      status: "inconclusive",
      reasonCode: "missing_data",
      reason: "No company name was extracted to search careers sources.",
      finding: "Cannot search official careers sources without a company name.",
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

  const cleanDomain = domain
    ? domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim().toLowerCase()
    : null;

  const query = buildCompanySearchQuery(company, "careers");

  let searchResults: Awaited<ReturnType<typeof searchGoogleWithSerpApi>> = [];
  try {
    searchResults = await searchGoogleWithSerpApi(query, 7000);
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

  // Prioritize candidates: employer domain -> employer ATS -> other -> aggregators last
  const prioritizedResults = [...searchResults].sort(
    (a, b) =>
      getCareersPagePriority(a.link, cleanDomain) -
      getCareersPagePriority(b.link, cleanDomain)
  );

  const candidates = selectCandidatePages(prioritizedResults);
  if (candidates.length === 0) {
    return {
      id: "careers_match",
      status: "inconclusive",
      reasonCode: "blocked_page",
      reason: "No candidate careers pages passed the domain filter.",
      finding: "Search results did not include a fetchable careers page.",
      whyItMatters: "Only fetchable employer and careers sources can corroborate an active vacancy.",
      checkedAt: now,
      evidence: [],
      signals: [],
      facts: { domain, domainOfficialConfirmed: false, domainResponse: null, domainCreatedAt: null, domainAgeDays: null, domainYoung: null, roleMatched: null, legalName: null, cin: null, identityMatch: "ambiguous" },
    };
  }

  const fetchedCandidates = await fetchCandidatePages(candidates);
  const pagesRead = fetchedCandidates.filter((candidate) => candidate.page !== null).length;
  let matchingPageFound = false;
  let confirmedDomain = false;

  for (const { item, page } of fetchedCandidates) {
    // Record search snippet lead
    evidenceList.push({
      id: `ev-car-snip-${evidenceList.length + 1}`,
      kind: "search_snippet",
      title: item.title,
      url: item.link,
      quote: item.snippet || null,
      provider: "SerpAPI",
      publishedAt: null,
      retrievedAt: now,
      classification: "unknown",
    });

    if (page) {
      const pageTextLower = page.text.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const roleLower = role.toLowerCase();
      const companyLower = company.toLowerCase();

      // Check if role and company match on this page
      const hasRole =
        (roleLower && pageTextLower.includes(roleLower)) ||
        (roleLower && titleLower.includes(roleLower));
      const hasCompany =
        companyLower ? pageTextLower.includes(companyLower) || titleLower.includes(companyLower) : true;

      if (hasRole && hasCompany) {
        matchingPageFound = true;
        if (cleanDomain && item.link.toLowerCase().includes(cleanDomain)) {
          confirmedDomain = true;
        }

        evidenceList.push({
          id: `ev-car-page-${evidenceList.length + 1}`,
          kind: "page",
          title: item.title,
          url: item.link,
          quote: page.text.slice(0, 300),
          provider: "web_read",
          publishedAt: null,
          retrievedAt: now,
          classification: "corroboration",
        });
      }
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
