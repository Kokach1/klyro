import { describe, it, expect } from "vitest";
import { checkMessageFlags } from "../lib/checks/message-flags";
import { getSixMonthsAgoThreshold } from "../lib/checks/domain-age";
import { ExtractedClaims, ExtractSource } from "../lib/contracts";

describe("Check 1: message_flags", () => {
  const baseClaims: ExtractedClaims = {
    companyName: "Acme Corp",
    role: "Analyst",
    salary: null,
    location: "Bengaluru",
    contacts: [],
    links: [],
    employerDomain: "acme.com",
    claimedOperatingYears: null,
    feeClaims: [],
  };

  it("does not flag negated fee statements such as 'No registration fee' and 'Never pay to get a job'", () => {
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: "Acme Corp is hiring Analysts. Note: There is No registration fee. Never pay to get a job with us.",
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      feeClaims: [
        { quote: "There is No registration fee", kind: "negated" },
        { quote: "Never pay to get a job with us", kind: "negated" },
      ],
    };

    const result = checkMessageFlags(source, claims);
    expect(result.status).toBe("completed");
    expect(result.signals.some((s) => s.code === "job_payment_demand")).toBe(false);
    expect(result.signals.some((s) => s.code === "training_job_condition")).toBe(false);
  });

  it("emits job_payment_demand (80 pts) for explicit candidate payment demands", () => {
    const quote = "Pay INR 2,000 to reserve your offer letter";
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: `Congratulations! ${quote}. Joining date next Monday.`,
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      feeClaims: [{ quote, kind: "demand" }],
    };

    const result = checkMessageFlags(source, claims);
    expect(result.signals.some((s) => s.code === "job_payment_demand")).toBe(true);
    const demandSig = result.signals.find((s) => s.code === "job_payment_demand");
    expect(demandSig?.points).toBe(80);
  });

  it("emits training_job_condition (80 pts) for mandatory paid training tied to a job", () => {
    const quote = "Mandatory paid training required to get the guaranteed job placement";
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: `Job offer: ${quote}. Course fees 10,000 INR.`,
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      feeClaims: [{ quote, kind: "training_offer" }],
    };

    const result = checkMessageFlags(source, claims);
    expect(result.signals.some((s) => s.code === "training_job_condition")).toBe(true);
    const trainingSig = result.signals.find((s) => s.code === "training_job_condition");
    expect(trainingSig?.points).toBe(80);
  });

  it("emits training_guarantee (20 pts) for training offer with ambiguous placement wording", () => {
    const quote = "Enroll in our certification course with placement assistance";
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: `${quote}. Fee 5,000 INR.`,
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      feeClaims: [{ quote, kind: "training_offer" }],
    };

    const result = checkMessageFlags(source, claims);
    expect(result.signals.some((s) => s.code === "training_guarantee")).toBe(true);
    const guaranteeSig = result.signals.find((s) => s.code === "training_guarantee");
    expect(guaranteeSig?.points).toBe(20);
  });

  it("emits unverified_pay with 0 points when salary alone is present", () => {
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: "Salary: 80,000 INR per month.",
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      salary: "80,000 INR per month",
    };

    const result = checkMessageFlags(source, claims);
    const paySig = result.signals.find((s) => s.code === "unverified_pay");
    expect(paySig).toBeDefined();
    expect(paySig?.points).toBe(0);
  });

  it("emits urgency (10 pts) and free_email_hr (10 pts) correctly", () => {
    const source: ExtractSource = {
      inputType: "text",
      url: null,
      text: "Hurry, act fast! Immediate payment required within 24 hours. Contact HR: hr.acme@gmail.com",
      retrievedAt: new Date().toISOString(),
    };
    const claims: ExtractedClaims = {
      ...baseClaims,
      contacts: [{ kind: "email", value: "hr.acme@gmail.com" }],
    };

    const result = checkMessageFlags(source, claims);
    expect(result.signals.some((s) => s.code === "urgency")).toBe(true);
    expect(result.signals.some((s) => s.code === "free_email_hr")).toBe(true);
  });
});

describe("Check 2: domain_age Date Math", () => {
  it("computes 6 calendar months prior with month-end and leap-year clamping", () => {
    // Leap year leap day: Aug 31, 2024 -> 6 months prior is Feb 2024 (29 days in leap year)
    const aug31Leap = new Date(Date.UTC(2024, 7, 31)); // month 7 is August
    const thresholdLeap = getSixMonthsAgoThreshold(aug31Leap);
    expect(thresholdLeap.getUTCFullYear()).toBe(2024);
    expect(thresholdLeap.getUTCMonth()).toBe(1); // February
    expect(thresholdLeap.getUTCDate()).toBe(29); // Clamped to 29 in 2024

    // Non-leap year: Aug 31, 2025 -> 6 months prior is Feb 2025 (28 days in non-leap year)
    const aug31NonLeap = new Date(Date.UTC(2025, 7, 31));
    const thresholdNonLeap = getSixMonthsAgoThreshold(aug31NonLeap);
    expect(thresholdNonLeap.getUTCFullYear()).toBe(2025);
    expect(thresholdNonLeap.getUTCMonth()).toBe(1);
    expect(thresholdNonLeap.getUTCDate()).toBe(28); // Clamped to 28 in 2025

    // March 31, 2026 -> 6 months prior is September 2025 (30 days in September)
    const mar31 = new Date(Date.UTC(2026, 2, 31)); // March 31
    const thresholdMar = getSixMonthsAgoThreshold(mar31);
    expect(thresholdMar.getUTCFullYear()).toBe(2025);
    expect(thresholdMar.getUTCMonth()).toBe(8); // September
    expect(thresholdMar.getUTCDate()).toBe(30); // Clamped to 30

    // Standard mid-month: Oct 10, 2026 -> Apr 10, 2026
    const oct10 = new Date(Date.UTC(2026, 9, 10)); // October 10
    const thresholdOct = getSixMonthsAgoThreshold(oct10);
    expect(thresholdOct.getUTCFullYear()).toBe(2026);
    expect(thresholdOct.getUTCMonth()).toBe(3); // April
    expect(thresholdOct.getUTCDate()).toBe(10);
  });
});
