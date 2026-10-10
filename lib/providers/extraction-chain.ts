import { ExtractedClaims } from "../contracts";
import { getServerEnv } from "../env";
import { extractClaimsWithGeminiKey } from "./gemini";
import { extractClaimsWithOpenAI } from "./openai";

export class ExtractionChainError extends Error {
  constructor(message: string, public details: string[]) {
    super(message);
    this.name = "ExtractionChainError";
  }
}

export interface ExtractionChainResult {
  extracted: ExtractedClaims;
  warnings: string[];
  providerUsed: "gemini" | "openai";
}

/**
 * Provider chain for structured claims extraction:
 * 1. Try GEMINI_API_KEYS in order.
 * 2. If every Gemini key fails or is quota-limited, fall back to OpenAI (gpt-4o-mini).
 * 3. If OpenAI also fails, throw an honest unavailable error without fabricating data or leaking keys.
 */
export async function extractClaimsWithProviderChain(
  postingText: string,
  timeoutMs = 15000
): Promise<ExtractionChainResult> {
  const env = getServerEnv();
  const geminiKeys = env.GEMINI_API_KEYS;
  const failureReasons: string[] = [];

  // Step 1: Try Gemini keys in order
  if (geminiKeys.length > 0) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      try {
        const result = await extractClaimsWithGeminiKey(key, postingText, timeoutMs);
        // Provider succeeded: finish scan on it
        return {
          extracted: result.extracted,
          warnings: result.warnings,
          providerUsed: "gemini",
        };
      } catch (err: any) {
        // Collect reason without leaking key value
        const reason = err.message || "Unknown error";
        failureReasons.push(`Gemini key #${i + 1} failed: ${reason}`);
      }
    }
  } else {
    failureReasons.push("No GEMINI_API_KEYS configured.");
  }

  // Step 2: Fall back to OpenAI
  if (env.OPENAI_API_KEY) {
    try {
      const result = await extractClaimsWithOpenAI(postingText, timeoutMs);
      return {
        extracted: result.extracted,
        warnings: [
          ...result.warnings,
          ...(geminiKeys.length > 0
            ? ["Primary Gemini keys were unavailable; fell back to OpenAI (gpt-4o-mini)."]
            : []),
        ],
        providerUsed: "openai",
      };
    } catch (err: any) {
      failureReasons.push(`OpenAI fallback failed: ${err.message || "Unknown error"}`);
    }
  } else {
    failureReasons.push("OPENAI_API_KEY is not configured.");
  }

  // Step 3: All providers exhausted - return honest unavailable error
  throw new ExtractionChainError(
    "Extraction service unavailable: all configured Gemini keys and OpenAI fallback failed.",
    failureReasons
  );
}
