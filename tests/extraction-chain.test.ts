import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractClaimsWithProviderChain,
  ExtractionChainError,
} from "../lib/providers/extraction-chain";
import * as geminiProvider from "../lib/providers/gemini";
import * as openAiProvider from "../lib/providers/openai";
import * as envModule from "../lib/env";
import { ExtractedClaims } from "../lib/contracts";

describe("Extraction Provider Chain (Gemini x N -> OpenAI -> Unavailable)", () => {
  const dummyClaims: ExtractedClaims = {
    companyName: "Acme Innovations",
    role: "Full Stack Developer",
    salary: "12,00,000 INR per annum",
    location: "Hyderabad",
    contacts: [{ kind: "email", value: "hr@acme.com" }],
    links: ["https://acme.com/jobs/123"],
    employerDomain: "acme.com",
    claimedOperatingYears: 8,
    feeClaims: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts via primary Gemini key when healthy", async () => {
    vi.spyOn(envModule, "getServerEnv").mockReturnValue({
      GEMINI_API_KEYS: ["gemini-key-1", "gemini-key-2"],
      OPENAI_API_KEY: "openai-test-key",
    });

    vi.spyOn(geminiProvider, "extractClaimsWithGeminiKey").mockResolvedValue({
      extracted: dummyClaims,
      warnings: [],
    });

    const openAiSpy = vi.spyOn(openAiProvider, "extractClaimsWithOpenAI");

    const result = await extractClaimsWithProviderChain("Sample posting text");
    expect(result.providerUsed).toBe("gemini");
    expect(result.extracted.companyName).toBe("Acme Innovations");
    expect(openAiSpy).not.toHaveBeenCalled();
  });

  it("rotates to next Gemini key when first key hits quota limit", async () => {
    vi.spyOn(envModule, "getServerEnv").mockReturnValue({
      GEMINI_API_KEYS: ["gemini-key-1", "gemini-key-2"],
      OPENAI_API_KEY: "openai-test-key",
    });

    vi.spyOn(geminiProvider, "extractClaimsWithGeminiKey")
      .mockRejectedValueOnce(new geminiProvider.GeminiQuotaError("HTTP 429 quota reached"))
      .mockResolvedValueOnce({
        extracted: dummyClaims,
        warnings: [],
      });

    const openAiSpy = vi.spyOn(openAiProvider, "extractClaimsWithOpenAI");

    const result = await extractClaimsWithProviderChain("Sample posting text");
    expect(result.providerUsed).toBe("gemini");
    expect(result.extracted.role).toBe("Full Stack Developer");
    expect(openAiSpy).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI when all Gemini keys are exhausted/quota-limited", async () => {
    vi.spyOn(envModule, "getServerEnv").mockReturnValue({
      GEMINI_API_KEYS: ["gemini-key-1", "gemini-key-2"],
      OPENAI_API_KEY: "openai-test-key",
    });

    vi.spyOn(geminiProvider, "extractClaimsWithGeminiKey")
      .mockRejectedValueOnce(new geminiProvider.GeminiQuotaError("Key 1 quota exceeded"))
      .mockRejectedValueOnce(new geminiProvider.GeminiQuotaError("Key 2 quota exceeded"));

    vi.spyOn(openAiProvider, "extractClaimsWithOpenAI").mockResolvedValue({
      extracted: dummyClaims,
      warnings: [],
    });

    const result = await extractClaimsWithProviderChain("Sample posting text");
    expect(result.providerUsed).toBe("openai");
    expect(result.extracted.companyName).toBe("Acme Innovations");
    expect(result.warnings.some((w) => w.includes("fell back to OpenAI"))).toBe(true);
  });

  it("throws honest unavailable error when everything is exhausted", async () => {
    vi.spyOn(envModule, "getServerEnv").mockReturnValue({
      GEMINI_API_KEYS: ["gemini-key-1"],
      OPENAI_API_KEY: "openai-test-key",
    });

    vi.spyOn(geminiProvider, "extractClaimsWithGeminiKey").mockRejectedValue(
      new geminiProvider.GeminiQuotaError("Gemini quota exhausted")
    );

    vi.spyOn(openAiProvider, "extractClaimsWithOpenAI").mockRejectedValue(
      new Error("OpenAI quota or service error")
    );

    await expect(
      extractClaimsWithProviderChain("Sample posting text")
    ).rejects.toThrow(ExtractionChainError);

    try {
      await extractClaimsWithProviderChain("Sample posting text");
    } catch (err: any) {
      expect(err.message).toContain("Extraction service unavailable");
      // Confirm no raw key string leaked in error
      expect(err.message).not.toContain("gemini-key-1");
      expect(err.message).not.toContain("openai-test-key");
    }
  });

  it("throws honest error when no provider keys are configured", async () => {
    vi.spyOn(envModule, "getServerEnv").mockReturnValue({
      GEMINI_API_KEYS: [],
      OPENAI_API_KEY: undefined,
    });

    await expect(
      extractClaimsWithProviderChain("Sample posting text")
    ).rejects.toThrow(ExtractionChainError);
  });
});
