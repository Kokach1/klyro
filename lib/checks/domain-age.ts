import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ReasonCode,
  Signal,
} from "../contracts";
import {
  extractEmployerRegistrableDomain,
  resolveAndValidateHostname,
  safeFetchUrl,
} from "../safe-fetch";
import { fetchWhoisData, WhoisXmlError } from "../providers/whoisxml";

/**
 * Calculates a date minus 6 calendar months in UTC, clamping to the last valid day of the target month.
 * Handles leap years and month-end variations precisely.
 */
export function getSixMonthsAgoThreshold(analysisDate: Date): Date {
  const currentYear = analysisDate.getUTCFullYear();
  const currentMonth = analysisDate.getUTCMonth(); // 0 - 11
  const currentDay = analysisDate.getUTCDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth - 6;

  if (targetMonth < 0) {
    targetYear -= 1;
    targetMonth += 12;
  }

  // Get total days in target month by creating date on day 0 of the next month
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(currentDay, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      analysisDate.getUTCHours(),
      analysisDate.getUTCMinutes(),
      analysisDate.getUTCSeconds(),
      analysisDate.getUTCMilliseconds()
    )
  );
}

/**
 * Check 2: domain_age
 * Verifies employer domain registration age and active web response.
 */
export async function checkDomainAge(
  claims: ExtractedClaims,
  analysisDate = new Date()
): Promise<CheckResult> {
  const now = analysisDate.toISOString();
  const evidenceList: Evidence[] = [];
  const signals: Signal[] = [];

  // Determine candidate domain
  let candidateDomain = extractEmployerRegistrableDomain(claims.employerDomain);

  // If employerDomain was not set, look through links
  if (!candidateDomain && claims.links && claims.links.length > 0) {
    for (const link of claims.links) {
      const parsed = extractEmployerRegistrableDomain(link);
      if (parsed) {
        candidateDomain = parsed;
        break;
      }
    }
  }

  // No domain supplied or found
  if (!candidateDomain) {
    return {
      id: "domain_age",
      status: "not_applicable",
      tier: "inconclusive",
      reasonCode: "no_domain",
      reason: "No employer domain was provided or discovered in the posting links.",
      finding: "No employer domain available to verify registration age.",
      whyItMatters:
        "Scammers frequently use disposable domains or avoid official domains altogether.",
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

  // 1. Probe domain DNS and HTTP response
  let domainResponse: "responds" | "blocked" | "not_resolved" | "unknown" = "unknown";
  try {
    await resolveAndValidateHostname(candidateDomain);
    // DNS resolved, now probe HTTP safely
    try {
      await safeFetchUrl(`https://${candidateDomain}`, {
        timeoutMs: 5000,
        maxBytes: 1024 * 512,
        maxRedirects: 2,
      });
      domainResponse = "responds";
    } catch (httpErr: any) {
      // 403, 429, cloudflare etc. is blocked, not unresolvable
      if (httpErr.message?.includes("blocked") || httpErr.code === "unsupported_content_type") {
        domainResponse = "blocked";
      } else {
        domainResponse = "responds"; // DNS resolved but HTTP returned non-200 or custom error
      }
    }
  } catch (dnsErr: any) {
    domainResponse = "not_resolved";
  }

  // 2. Fetch WHOIS registration date
  let whoisResult: Awaited<ReturnType<typeof fetchWhoisData>> | null = null;
  let status: CheckResult["status"] = "completed";
  let reasonCode: ReasonCode | null = null;
  let reason: string | null = null;

  try {
    whoisResult = await fetchWhoisData(candidateDomain, 15000);
  } catch (err: any) {
    if (err instanceof WhoisXmlError) {
      reasonCode = err.code as ReasonCode;
      reason = err.message;
      status = "unavailable";
    } else {
      reasonCode = "provider_error";
      reason = err.message || "Failed to retrieve WHOIS data.";
      status = "unavailable";
    }
  }

  let domainCreatedAt: string | null = null;
  let domainAgeDays: number | null = null;
  let domainYoung: boolean | null = null;

  if (whoisResult) {
    const rawDate = whoisResult.createdDateRaw || whoisResult.registryCreatedDateRaw;
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() <= analysisDate.getTime()) {
        domainCreatedAt = parsedDate.toISOString();
        const diffMs = analysisDate.getTime() - parsedDate.getTime();
        domainAgeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        const thresholdDate = getSixMonthsAgoThreshold(analysisDate);
        domainYoung = parsedDate.getTime() > thresholdDate.getTime();

        evidenceList.push({
          id: "ev-dom-whois",
          kind: "whois",
          title: `WHOIS creation date for ${candidateDomain}`,
          url: null,
          quote: `Domain created: ${domainCreatedAt} (Age: ${domainAgeDays} days)${
            whoisResult.registrantMasked ? " [Registrant privacy protected]" : ""
          }`,
          provider: "WhoisXML",
          publishedAt: domainCreatedAt,
          retrievedAt: now,
          classification: "official_finding",
        });

        // young_domain_history: ONLY if domain under 6 months AND posting explicitly claims older history
        if (domainYoung && claims.claimedOperatingYears && claims.claimedOperatingYears > 0) {
          const evId = "ev-dom-conflict";
          evidenceList.push({
            id: evId,
            kind: "input_quote",
            title: "Operating history vs domain age conflict",
            url: null,
            quote: `Posting claims ${claims.claimedOperatingYears} years operating history, but domain ${candidateDomain} was registered only ${domainAgeDays} days ago.`,
            provider: null,
            publishedAt: null,
            retrievedAt: now,
            classification: "posting_claim",
          });

          signals.push({
            code: "young_domain_history",
            points: 15,
            evidenceIds: [evId, "ev-dom-whois"],
            explanation: `Employer domain (${candidateDomain}) was registered recently (${domainAgeDays} days ago), contradicting the posting's claim of ${claims.claimedOperatingYears} years in business.`,
          });
        }
      } else {
        // Future date or invalid date
        status = "inconclusive";
        reasonCode = "missing_data";
        reason = "WHOIS record returned an invalid or future creation date.";
      }
    } else {
      // Creation date absent
      status = "inconclusive";
      reasonCode = "missing_data";
      reason = "WHOIS record does not contain a verified domain creation date.";
    }
  }

  let finding = "";
  if (status === "unavailable") {
    finding = `WHOIS check unavailable for ${candidateDomain}: ${reason}`;
  } else if (status === "inconclusive") {
    finding = `WHOIS creation date could not be established for ${candidateDomain}.`;
  } else {
    if (domainYoung) {
      finding = `Domain ${candidateDomain} was created ${domainAgeDays} days ago (under 6 months old).`;
    } else {
      finding = `Domain ${candidateDomain} was created on ${domainCreatedAt?.slice(0, 10)} (${domainAgeDays} days old).`;
    }
  }

  return {
    id: "domain_age",
    status,
    tier: status === "completed" ? "verified" : "inconclusive",
    reasonCode,
    reason,
    finding,
    whyItMatters:
      "Fraudulent recruitment operations frequently operate from freshly registered domains created within the last few weeks or months.",
    checkedAt: now,
    evidence: evidenceList,
    signals,
    facts: {
      domain: candidateDomain,
      domainOfficialConfirmed: false, // confirmed only after careers cross-check
      domainResponse,
      domainCreatedAt,
      domainAgeDays,
      domainYoung,
      roleMatched: null,
      legalName: null,
      cin: null,
      identityMatch: domainYoung === false ? "ambiguous" : "none",
    },
  };
}
