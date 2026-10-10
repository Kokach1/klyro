import { describe, it, expect } from "vitest";
import { validateFeeClaimsAgainstSource } from "../lib/providers/openai";
import { FeeClaim } from "../lib/contracts";

describe("Extraction Fee Quotes Validation", () => {
  it("keeps quotes that exist in the source text and discards fabricated ones", () => {
    const sourceText = "Welcome to Tech Corp! Note: Pay INR 2000 registration fee to confirm interview.";

    const feeClaims: FeeClaim[] = [
      {
        quote: "Pay INR 2000 registration fee to confirm interview",
        kind: "demand",
      },
      {
        quote: "Send $500 bitcoin deposit immediately", // Fabricated!
        kind: "demand",
      },
      {
        quote: "registration fee",
        kind: "demand",
      },
    ];

    const validated = validateFeeClaimsAgainstSource(feeClaims, sourceText);
    expect(validated.length).toBe(2);
    expect(validated[0].quote).toBe("Pay INR 2000 registration fee to confirm interview");
    expect(validated[1].quote).toBe("registration fee");
  });

  it("handles normalized whitespace in source text quotes", () => {
    const sourceText = "We offer a guaranteed placement course.\nCost is INR 15,000 upfront.";
    const feeClaims: FeeClaim[] = [
      {
        quote: "Cost is INR 15,000 upfront.",
        kind: "training_offer",
      },
    ];

    const validated = validateFeeClaimsAgainstSource(feeClaims, sourceText);
    expect(validated.length).toBe(1);
  });
});
