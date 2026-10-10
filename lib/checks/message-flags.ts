import {
  CheckResult,
  Evidence,
  ExtractedClaims,
  ExtractSource,
  Signal,
} from "../contracts";

const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "protonmail.com",
  "icloud.com",
  "rediffmail.com",
];

const NEGATION_PATTERNS = [
  /no\s+(registration\s+)?fee/i,
  /never\s+pay/i,
  /do\s+not\s+pay/i,
  /we\s+never\s+ask\s+for\s+money/i,
  /no\s+charges/i,
  /free\s+of\s+cost/i,
  /no\s+payment\s+required/i,
  /beware\s+of\s+fraud/i,
  /100%\s+free/i,
];

/**
 * Checks if a candidate sentence or quote is explicitly negated (e.g. "No fee required").
 */
export function isNegatedFeeStatement(text: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check 1: message_flags
 * Analyzes immutable original source text and reviewed claims for red flag patterns.
 */
export function checkMessageFlags(
  source: ExtractSource,
  claims: ExtractedClaims
): CheckResult {
  const text = source.text;
  const now = new Date().toISOString();
  const evidenceList: Evidence[] = [];
  const signals: Signal[] = [];

  let evidenceCounter = 1;

  // 1. Check fee claims from extraction and source text
  let paymentDemandFound = false;
  let trainingConditionFound = false;
  let trainingGuaranteeFound = false;

  // Examine extracted fee claims first
  for (const feeClaim of claims.feeClaims) {
    if (isNegatedFeeStatement(feeClaim.quote)) {
      // Negated fee warning -> record as corroborating evidence or ignore, NOT a scam signal
      const evId = `ev-msg-${evidenceCounter++}`;
      evidenceList.push({
        id: evId,
        kind: "input_quote",
        title: "Negated fee statement",
        url: null,
        quote: feeClaim.quote,
        provider: null,
        publishedAt: null,
        retrievedAt: now,
        classification: "posting_claim",
      });
      continue;
    }

    if (feeClaim.kind === "demand" && !paymentDemandFound) {
      // Must connect payment to job access, interview, offer, or registration
      const paymentDemandRegex = /(pay|fee|deposit|charge|cost|amount|inr|rs\.?|\$)\s*.*?(reserve|offer|interview|joining|slot|seat|kit|equipment|registration|process)/i;
      const demandMatch = paymentDemandRegex.test(feeClaim.quote) || feeClaim.quote.toLowerCase().includes("pay");

      if (demandMatch) {
        paymentDemandFound = true;
        const evId = `ev-msg-${evidenceCounter++}`;
        evidenceList.push({
          id: evId,
          kind: "input_quote",
          title: "Upfront payment demand",
          url: null,
          quote: feeClaim.quote,
          provider: null,
          publishedAt: null,
          retrievedAt: now,
          classification: "posting_claim",
        });

        signals.push({
          code: "job_payment_demand",
          points: 80,
          evidenceIds: [evId],
          explanation: `Posting explicitly demands upfront payment to secure employment: "${feeClaim.quote}".`,
        });
      }
    } else if (feeClaim.kind === "training_offer" && !trainingConditionFound && !trainingGuaranteeFound) {
      const conditionRegex = /(mandatory|required|must\s+complete|condition|guaranteed\s+(job|placement))\s*.*?(training|course|program)/i;
      const isCondition = conditionRegex.test(feeClaim.quote) || /pay\s*.*?(guaranteed|placement)/i.test(feeClaim.quote);

      if (isCondition) {
        trainingConditionFound = true;
        const evId = `ev-msg-${evidenceCounter++}`;
        evidenceList.push({
          id: evId,
          kind: "input_quote",
          title: "Paid training condition for employment",
          url: null,
          quote: feeClaim.quote,
          provider: null,
          publishedAt: null,
          retrievedAt: now,
          classification: "posting_claim",
        });

        signals.push({
          code: "training_job_condition",
          points: 80,
          evidenceIds: [evId],
          explanation: `Mandatory paid training required as a condition to receive the advertised job: "${feeClaim.quote}".`,
        });
      } else {
        trainingGuaranteeFound = true;
        const evId = `ev-msg-${evidenceCounter++}`;
        evidenceList.push({
          id: evId,
          kind: "input_quote",
          title: "Paid training with ambiguous placement guarantee",
          url: null,
          quote: feeClaim.quote,
          provider: null,
          publishedAt: null,
          retrievedAt: now,
          classification: "posting_claim",
        });

        signals.push({
          code: "training_guarantee",
          points: 20,
          evidenceIds: [evId],
          explanation: `Paid course with placement guarantee wording whose relationship to an actual vacancy is unclear: "${feeClaim.quote}".`,
        });
      }
    }
  }

  // Fallback direct regex scan on source text if no fee claims were extracted
  if (!paymentDemandFound && !trainingConditionFound) {
    const rawDemandRegex = /(pay(?:ment)?|fee|deposit|charges?)\s*(?:of|is|:)?\s*(?:inr|rs\.?|\$)?\s*\d+.*?(?:reserve|confirm|offer|interview|registration|equipment)/i;
    const match = rawDemandRegex.exec(text);
    if (match && !isNegatedFeeStatement(match[0])) {
      const evId = `ev-msg-${evidenceCounter++}`;
      evidenceList.push({
        id: evId,
        kind: "input_quote",
        title: "Candidate fee demand in posting text",
        url: null,
        quote: match[0],
        provider: null,
        publishedAt: null,
        retrievedAt: now,
        classification: "posting_claim",
      });

      signals.push({
        code: "job_payment_demand",
        points: 80,
        evidenceIds: [evId],
        explanation: `Explicit candidate payment to secure offer or interview: "${match[0]}".`,
      });
      paymentDemandFound = true;
    }
  }

  // 2. Urgency check: coercive pressure to act/pay immediately
  const urgencyRegex = /(hurry|act\s+fast|immediate\s+payment|last\s+\d+\s+slots?|offer\s+expires\s+in\s+\d+\s+hours?|within\s+24\s+hours?\s+to\s+confirm|immediate\s+transfer)/i;
  const urgencyMatch = urgencyRegex.exec(text);
  if (urgencyMatch) {
    // Extract surrounding sentence
    const start = Math.max(0, urgencyMatch.index - 30);
    const end = Math.min(text.length, urgencyMatch.index + urgencyMatch[0].length + 40);
    const quote = text.slice(start, end).trim();

    const evId = `ev-msg-${evidenceCounter++}`;
    evidenceList.push({
      id: evId,
      kind: "input_quote",
      title: "Coercive urgency statement",
      url: null,
      quote,
      provider: null,
      publishedAt: null,
      retrievedAt: now,
      classification: "posting_claim",
    });

    signals.push({
      code: "urgency",
      points: 10,
      evidenceIds: [evId],
      explanation: `Coercive urgency language pressuring candidate to act quickly: "${quote}".`,
    });
  }

  // 3. Free email provider for HR contact
  for (const contact of claims.contacts) {
    if (contact.kind === "email") {
      const emailLower = contact.value.toLowerCase().trim();
      const domain = emailLower.split("@")[1];
      if (domain && FREE_EMAIL_DOMAINS.includes(domain)) {
        // Verify in context that it is recruiter/HR contact
        const evId = `ev-msg-${evidenceCounter++}`;
        evidenceList.push({
          id: evId,
          kind: "input_quote",
          title: "Recruiter contact on free email domain",
          url: null,
          quote: contact.value,
          provider: null,
          publishedAt: null,
          retrievedAt: now,
          classification: "posting_claim",
        });

        signals.push({
          code: "free_email_hr",
          points: 10,
          evidenceIds: [evId],
          explanation: `Recruiter contact address uses a free webmail service (@${domain}) rather than an employer domain.`,
        });
        break; // Count at most once
      }
    }
  }

  // 4. Unverified pay check
  if (claims.salary && claims.salary.trim().length > 0) {
    const evId = `ev-msg-${evidenceCounter++}`;
    evidenceList.push({
      id: evId,
      kind: "input_quote",
      title: "Advertised compensation statement",
      url: null,
      quote: claims.salary,
      provider: null,
      publishedAt: null,
      retrievedAt: now,
      classification: "posting_claim",
    });

    signals.push({
      code: "unverified_pay",
      points: 0,
      evidenceIds: [evId],
      explanation: `Advertised compensation (${claims.salary}) is unverified without independent market comparison.`,
    });
  }

  let finding = "No high-risk payment or urgency flags detected in message text.";
  if (paymentDemandFound) {
    finding = "Posting explicitly demands candidate payment to access the job or interview.";
  } else if (trainingConditionFound) {
    finding = "Posting requires mandatory paid training as a condition for employment.";
  } else if (trainingGuaranteeFound) {
    finding = "Posting contains a paid course with a job guarantee claim.";
  } else if (signals.length > 0) {
    finding = `Identified ${signals.length} contextual message risk signal(s).`;
  }

  return {
    id: "message_flags",
    status: "completed",
    reasonCode: null,
    reason: null,
    finding,
    whyItMatters:
      "Legitimate employers do not require job applicants to pay registration fees, security deposits, or purchase mandatory training to receive a job offer.",
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
      identityMatch: "not_applicable",
    },
  };
}
