import { describe, it, expect } from "vitest";
import {
  deduplicateAndScoreSignals,
  calculateCoverage,
  evaluateVerdict,
  generateRuleSummary,
  SIGNAL_POINTS,
  LABEL_EXPLANATIONS,
} from "../lib/rules";
import { CheckResult, Signal } from "../lib/contracts";

describe("lib/rules: Deterministic Scoring & Gates", () => {
  const dummyFacts = {
    domain: "acme.com",
    domainOfficialConfirmed: true,
    domainResponse: "responds" as const,
    domainCreatedAt: "2020-01-01T00:00:00Z",
    domainAgeDays: 2000,
    domainYoung: false,
    roleMatched: true,
    legalName: "Acme Corporation Pvt Ltd",
    cin: "U72200KA2020PTC123456",
    identityMatch: "high" as const,
  };

  const createCompletedCheck = (id: CheckResult["id"]): CheckResult => ({
    id,
    status: "completed",
    reasonCode: null,
    reason: null,
    finding: `Completed check for ${id}`,
    whyItMatters: "Why it matters",
    checkedAt: new Date().toISOString(),
    evidence: [],
    signals: [],
    facts: dummyFacts,
  });

  it("resolves fee signal conflicts by selecting only the strongest and preferring payment demand on tie", () => {
    const rawSignals: Signal[] = [
      {
        code: "job_payment_demand",
        points: 80,
        evidenceIds: ["ev-1"],
        explanation: "Demand 1",
      },
      {
        code: "training_job_condition",
        points: 80,
        evidenceIds: ["ev-2"],
        explanation: "Training condition",
      },
      {
        code: "training_guarantee",
        points: 20,
        evidenceIds: ["ev-3"],
        explanation: "Guarantee",
      },
    ];

    const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
    expect(acceptedSignals.length).toBe(1);
    expect(acceptedSignals[0].code).toBe("job_payment_demand");
    expect(totalPoints).toBe(80);
  });

  it("caps total riskIndex at 100", () => {
    const rawSignals: Signal[] = [
      { code: "job_payment_demand", points: 80, evidenceIds: [], explanation: "" },
      { code: "urgency", points: 10, evidenceIds: [], explanation: "" },
      { code: "free_email_hr", points: 10, evidenceIds: [], explanation: "" },
      { code: "young_domain_history", points: 15, evidenceIds: [], explanation: "" },
      { code: "careers_not_found", points: 10, evidenceIds: [], explanation: "" },
    ];

    const { totalPoints } = deduplicateAndScoreSignals(rawSignals);
    expect(totalPoints).toBe(100);
  });

  it("applies Harmful-pattern override: job_payment_demand -> Likely Scam even if external checks fail", () => {
    const signals: Signal[] = [
      { code: "job_payment_demand", points: 80, evidenceIds: ["ev-1"], explanation: "Deposit required" },
    ];
    // external checks failed or unavailable
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      { ...createCompletedCheck("domain_age"), status: "unavailable", reasonCode: "missing_key" },
      { ...createCompletedCheck("careers_match"), status: "unavailable", reasonCode: "missing_key" },
      { ...createCompletedCheck("registration"), status: "unavailable", reasonCode: "missing_key" },
      { ...createCompletedCheck("complaints"), status: "unavailable", reasonCode: "missing_key" },
    ];

    const verdict = evaluateVerdict(checks, signals, 80);
    expect(verdict.label).toBe("Likely Scam");
    expect(verdict.ruleId).toBe("harmful_payment_override");
    expect(verdict.riskIndex).toBe(80);
    expect(verdict.labelExplanation).toBe(LABEL_EXPLANATIONS["Likely Scam"]);
  });

  it("applies Safe gate when all core checks pass, 0 points, domain confirmed, role matched, no identity gap", () => {
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      createCompletedCheck("domain_age"),
      createCompletedCheck("careers_match"),
      createCompletedCheck("registration"),
      createCompletedCheck("complaints"),
    ];

    const verdict = evaluateVerdict(checks, [], 0);
    expect(verdict.label).toBe("Safe");
    expect(verdict.ruleId).toBe("safe_gate");
    expect(verdict.riskIndex).toBe(0);
    expect(verdict.labelExplanation).toBe(LABEL_EXPLANATIONS["Safe"]);
  });

  it("defaults to Caution with coverage explanation when any check is inconclusive or unavailable, even with 0 points", () => {
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      createCompletedCheck("domain_age"),
      {
        ...createCompletedCheck("careers_match"),
        status: "inconclusive",
        reasonCode: "blocked_page",
      },
      createCompletedCheck("registration"),
      createCompletedCheck("complaints"),
    ];

    const verdict = evaluateVerdict(checks, [], 0);
    expect(verdict.label).toBe("Caution");
    expect(verdict.ruleId).toBe("caution_default");
    expect(verdict.riskIndex).toBe(0);
    expect(verdict.labelExplanation).toContain("based on 4 of 5 checks");
    expect(verdict.labelExplanation).toContain("Safe label is locked");
  });

  it("scores from completed checks only when 3 of 5 checks completed (missing checks stay neutral / 0 points)", () => {
    const checks: CheckResult[] = [
      {
        ...createCompletedCheck("message_flags"),
        status: "completed",
        signals: [
          { code: "urgency", points: 10, evidenceIds: ["ev-1"], explanation: "Urgent" },
          { code: "free_email_hr", points: 10, evidenceIds: ["ev-2"], explanation: "Gmail" },
        ],
      },
      {
        ...createCompletedCheck("domain_age"),
        status: "completed",
        signals: [
          { code: "young_domain_history", points: 15, evidenceIds: ["ev-3"], explanation: "Young domain" },
        ],
      },
      {
        ...createCompletedCheck("careers_match"),
        status: "completed",
        signals: [],
      },
      {
        ...createCompletedCheck("registration"),
        status: "unavailable",
        reasonCode: "missing_key",
        signals: [],
      },
      {
        ...createCompletedCheck("complaints"),
        status: "unavailable",
        reasonCode: "timeout",
        signals: [],
      },
    ];

    // Score from completed checks only
    const completedChecks = checks.filter((c) => c.status === "completed");
    expect(completedChecks.length).toBe(3);

    const rawSignals = completedChecks.flatMap((c) => c.signals);
    const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
    const coverage = calculateCoverage(checks);

    expect(coverage.completed).toBe(3);
    expect(coverage.total).toBe(5);
    // 10 + 10 + 15 = 35 points from completed checks; unavailable checks added 0 points
    expect(totalPoints).toBe(35);

    const verdict = evaluateVerdict(checks, acceptedSignals, totalPoints);
    expect(verdict.label).toBe("Caution");
    expect(verdict.riskIndex).toBe(35);
    expect(verdict.labelExplanation).toContain("based on 3 of 5 checks");
    expect(verdict.labelExplanation).toContain("Safe label is locked");
  });

  it("keeps Safe label locked on 0 points if only 3 of 5 checks completed", () => {
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      createCompletedCheck("domain_age"),
      createCompletedCheck("careers_match"),
      {
        ...createCompletedCheck("registration"),
        status: "unavailable",
        reasonCode: "missing_key",
      },
      {
        ...createCompletedCheck("complaints"),
        status: "inconclusive",
        reasonCode: "no_data",
      },
    ];

    const completedChecks = checks.filter((c) => c.status === "completed");
    const rawSignals = completedChecks.flatMap((c) => c.signals);
    const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
    const coverage = calculateCoverage(checks);

    expect(totalPoints).toBe(0);
    expect(coverage.completed).toBe(3);

    const verdict = evaluateVerdict(checks, acceptedSignals, totalPoints);
    // Even with 0 points, Safe label is LOCKED
    expect(verdict.label).toBe("Caution");
    expect(verdict.riskIndex).toBe(0);
    expect(verdict.labelExplanation).toContain("based on 3 of 5 checks");
    expect(verdict.labelExplanation).toContain("Safe label is locked");
  });

  it("defaults to Caution for non-harmful signals like urgency + free_email_hr (20 pts)", () => {
    const signals: Signal[] = [
      { code: "urgency", points: 10, evidenceIds: [], explanation: "Urgent" },
      { code: "free_email_hr", points: 10, evidenceIds: [], explanation: "Gmail" },
    ];
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      createCompletedCheck("domain_age"),
      createCompletedCheck("careers_match"),
      createCompletedCheck("registration"),
      createCompletedCheck("complaints"),
    ];

    const verdict = evaluateVerdict(checks, signals, 20);
    expect(verdict.label).toBe("Caution");
    expect(verdict.ruleId).toBe("caution_default");
    expect(verdict.riskIndex).toBe(20);
    expect(verdict.labelExplanation).toBe(LABEL_EXPLANATIONS["Caution"]);
  });

  it("computes coverage summing to 5", () => {
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      { ...createCompletedCheck("domain_age"), status: "inconclusive" },
      { ...createCompletedCheck("careers_match"), status: "unavailable" },
      { ...createCompletedCheck("registration"), status: "not_applicable" },
      createCompletedCheck("complaints"),
    ];

    const coverage = calculateCoverage(checks);
    expect(coverage.total).toBe(5);
    expect(coverage.completed).toBe(2);
    expect(coverage.inconclusive).toBe(1);
    expect(coverage.unavailable).toBe(1);
    expect(coverage.notApplicable).toBe(1);
    expect(
      coverage.completed + coverage.inconclusive + coverage.unavailable + coverage.notApplicable
    ).toBe(5);
  });

  it("generates honest deterministic rule summaries", () => {
    const checks: CheckResult[] = [
      createCompletedCheck("message_flags"),
      createCompletedCheck("domain_age"),
      createCompletedCheck("careers_match"),
      createCompletedCheck("registration"),
      createCompletedCheck("complaints"),
    ];
    const coverage = calculateCoverage(checks);
    const summaryData = generateRuleSummary(
      "Safe",
      "safe_gate",
      0,
      coverage,
      [],
      checks
    );

    expect(summaryData.summary).toContain("All 5 checks completed successfully");
    expect(summaryData.nextSteps.length).toBeLessThanOrEqual(3);
    expect(summaryData.nextSteps.length).toBeGreaterThan(0);
  });
});
