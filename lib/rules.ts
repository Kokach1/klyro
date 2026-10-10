import {
  CheckResult,
  Coverage,
  Signal,
  SignalCode,
  VerdictDetails,
  VerdictLabel,
  RuleId,
} from "./contracts";

export const SIGNAL_POINTS: Record<SignalCode, number> = {
  job_payment_demand: 80,
  training_job_condition: 80,
  training_guarantee: 20,
  urgency: 10,
  free_email_hr: 10,
  unverified_pay: 0,
  young_domain_history: 15,
  careers_not_found: 10,
  complaint_pattern: 20,
};

export const LABEL_EXPLANATIONS: Record<VerdictLabel, string> = {
  Safe: "No major risk signals found in completed checks. Not a guarantee.",
  Caution: "Some concerns or checks remain unresolved.",
  "Likely Scam": "Strong scam-pattern indicators in this posting.",
};

export const FIXED_DISCLAIMER =
  "This tool reports risk signals and allegations found, not legal findings or guaranteed legitimacy.";

/**
 * Filter and deduplicate signals according to business rules:
 * 1. At most one signal per code per scan.
 * 2. Only the strongest of (job_payment_demand, training_job_condition, training_guarantee) counts.
 *    Prefer job_payment_demand on tie.
 * 3. Recompute points deterministically using SIGNAL_POINTS table.
 */
export function deduplicateAndScoreSignals(rawSignals: Signal[]): {
  acceptedSignals: Signal[];
  totalPoints: number;
} {
  const signalMap = new Map<SignalCode, Signal>();

  for (const sig of rawSignals) {
    if (!signalMap.has(sig.code)) {
      signalMap.set(sig.code, {
        ...sig,
        points: SIGNAL_POINTS[sig.code] ?? 0,
      });
    }
  }

  // Related fee signals conflict resolution:
  // Pick only strongest of job_payment_demand (80), training_job_condition (80), training_guarantee (20)
  const hasPaymentDemand = signalMap.has("job_payment_demand");
  const hasTrainingCondition = signalMap.has("training_job_condition");
  const hasTrainingGuarantee = signalMap.has("training_guarantee");

  if (hasPaymentDemand && hasTrainingCondition) {
    // Tie between 80 and 80 -> prefer job_payment_demand
    signalMap.delete("training_job_condition");
    signalMap.delete("training_guarantee");
  } else if (hasPaymentDemand) {
    signalMap.delete("training_guarantee");
  } else if (hasTrainingCondition) {
    signalMap.delete("training_guarantee");
  }

  const acceptedSignals = Array.from(signalMap.values());
  const sum = acceptedSignals.reduce((acc, curr) => acc + curr.points, 0);
  const totalPoints = Math.min(100, Math.max(0, sum));

  return { acceptedSignals, totalPoints };
}

/**
 * Calculate coverage statistics across the five checks.
 */
export function calculateCoverage(checks: CheckResult[]): Coverage {
  let completed = 0;
  let inconclusive = 0;
  let unavailable = 0;
  let notApplicable = 0;

  for (const c of checks) {
    switch (c.status) {
      case "completed":
        completed++;
        break;
      case "inconclusive":
        inconclusive++;
        break;
      case "unavailable":
        unavailable++;
        break;
      case "not_applicable":
        notApplicable++;
        break;
    }
  }

  return {
    total: 5,
    completed,
    inconclusive,
    unavailable,
    notApplicable,
  };
}

/**
 * Evaluate deterministic verdict based on checks, facts, and signals.
 * Evaluation precedence:
 * 1. Harmful-pattern override:
 *    Accepted job_payment_demand or training_job_condition with direct quote -> Likely Scam
 * 2. Safe gate:
 *    All applicable checks completed, none inconclusive/unavailable,
 *    message_flags, domain_age, careers_match completed,
 *    domainOfficialConfirmed === true and roleMatched === true,
 *    totalPoints === 0, no identity gap (identityMatch !== 'ambiguous' and identityMatch !== 'none').
 * 3. Default:
 *    Caution in all other cases.
 */
export function evaluateVerdict(
  checks: CheckResult[],
  acceptedSignals: Signal[],
  totalPoints: number
): {
  label: VerdictLabel;
  ruleId: RuleId;
  riskIndex: number;
  labelExplanation: string;
} {
  const coverage = calculateCoverage(checks);

  // 1. Harmful-pattern override
  const hasHarmfulPayment = acceptedSignals.some(
    (s) => s.code === "job_payment_demand" || s.code === "training_job_condition"
  );
  if (hasHarmfulPayment) {
    return {
      label: "Likely Scam",
      ruleId: "harmful_payment_override",
      riskIndex: totalPoints,
      labelExplanation: LABEL_EXPLANATIONS["Likely Scam"],
    };
  }

  // 2. Safe gate evaluation
  // The Safe label stays locked: Safe only when ALL applicable checks completed and clean.
  // With partial coverage the best label is Caution with 'based on X of 5 checks'
  const messageCheck = checks.find((c) => c.id === "message_flags");
  const domainCheck = checks.find((c) => c.id === "domain_age");
  const careersCheck = checks.find((c) => c.id === "careers_match");

  const anyInconclusive = checks.some((c) => c.status === "inconclusive");
  const anyUnavailable = checks.some((c) => c.status === "unavailable");

  const allApplicableCompleted =
    coverage.completed === coverage.total &&
    !anyInconclusive &&
    !anyUnavailable;

  const coreCompleted =
    messageCheck?.status === "completed" &&
    domainCheck?.status === "completed" &&
    careersCheck?.status === "completed";

  const domainOfficialConfirmed = domainCheck?.facts.domainOfficialConfirmed === true;
  const roleMatched = careersCheck?.facts.roleMatched === true;

  const hasIdentityGap = checks.some(
    (c) => c.facts.identityMatch === "ambiguous" || c.facts.identityMatch === "none"
  );

  const passesSafeGate =
    allApplicableCompleted &&
    coreCompleted &&
    domainOfficialConfirmed &&
    roleMatched &&
    totalPoints === 0 &&
    !hasIdentityGap;

  if (passesSafeGate) {
    return {
      label: "Safe",
      ruleId: "safe_gate",
      riskIndex: 0,
      labelExplanation: LABEL_EXPLANATIONS["Safe"],
    };
  }

  // 3. Caution default / Partial coverage
  const isPartial = coverage.completed < coverage.total;
  const labelExplanation = isPartial
    ? `Caution (based on ${coverage.completed} of ${coverage.total} checks): Safe label is locked until all checks complete.`
    : LABEL_EXPLANATIONS["Caution"];

  return {
    label: "Caution",
    ruleId: "caution_default",
    riskIndex: totalPoints,
    labelExplanation,
  };
}

/**
 * Generate a deterministic rule-based summary and next steps.
 */
export function generateRuleSummary(
  label: VerdictLabel,
  ruleId: RuleId,
  riskIndex: number,
  coverage: Coverage,
  signals: Signal[],
  checks: CheckResult[]
): {
  summary: string;
  nextSteps: string[];
} {
  const signalDescriptions = signals.map((s) => s.explanation);
  const unavailableOrInconclusive = checks
    .filter((c) => c.status === "unavailable" || c.status === "inconclusive")
    .map((c) => `${c.id.replace("_", " ")} (${c.status}${c.reason ? `: ${c.reason}` : ""})`);

  let summary = "";
  const nextSteps: string[] = [];

  if (ruleId === "harmful_payment_override") {
    summary = `High risk detected. This posting contains an explicit payment or fee condition to obtain employment or mandatory training. Scored risk index is ${riskIndex} (based on ${coverage.completed} of ${coverage.total} checks).`;
    nextSteps.push("Do not send money, deposits, or gift cards to secure this position.");
    nextSteps.push("Verify the job directly on the employer's official website careers portal.");
    nextSteps.push("Cease contact with this recruiter if they insist on upfront payment.");
  } else if (ruleId === "safe_gate") {
    summary = `All 5 checks completed successfully with zero observed risk signals. The employer domain and job vacancy were corroborated against official sources.`;
    nextSteps.push("Review standard job details and contract terms before signing.");
    nextSteps.push("Ensure communications stay within the verified employer domain.");
    nextSteps.push("Remember: verification of published records is not an absolute guarantee.");
  } else {
    // Caution default
    if (signals.length > 0) {
      summary = `Caution advised. ${signals.length} risk signal(s) observed (${signals.map((s) => s.code.replace(/_/g, " ")).join(", ")}). Risk index: ${riskIndex} (based on ${coverage.completed} of ${coverage.total} checks).`;
    } else {
      summary = `No scored risk signals found in completed checks, but verification is incomplete (${coverage.completed} of ${coverage.total} checks completed). Safe label is locked until all checks complete.`;
    }

    if (unavailableOrInconclusive.length > 0) {
      summary += ` Unresolved checks: ${unavailableOrInconclusive.join(", ")}.`;
    }

    nextSteps.push("Do not pay any application, registration, or equipment fees.");
    nextSteps.push("Search independently for the company's verified website and careers page.");
    nextSteps.push("Confirm recruiter identity via official company contact channels.");
  }

  return { summary, nextSteps: nextSteps.slice(0, 3) };
}
