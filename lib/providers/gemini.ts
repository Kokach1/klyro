import { ExtractedClaims, ExtractedClaimsSchema } from "../contracts";
import { EXTRACTION_SYSTEM_PROMPT } from "../prompts";
import { validateFeeClaimsAgainstSource } from "./openai";
import { getServerEnv } from "../env";

export class GeminiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "GeminiError";
  }
}

export class GeminiQuotaError extends GeminiError {
  constructor(message: string) {
    super(message, "quota");
    this.name = "GeminiQuotaError";
  }
}

export const GEMINI_EXTRACTED_CLAIMS_SCHEMA = {
  type: "OBJECT",
  properties: {
    companyName: { type: "STRING", nullable: true },
    role: { type: "STRING", nullable: true },
    salary: { type: "STRING", nullable: true },
    location: { type: "STRING", nullable: true },
    contacts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["email", "phone", "other"] },
          value: { type: "STRING" },
        },
        required: ["kind", "value"],
      },
    },
    links: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    employerDomain: { type: "STRING", nullable: true },
    claimedOperatingYears: { type: "INTEGER", nullable: true },
    feeClaims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          quote: { type: "STRING" },
          kind: {
            type: "STRING",
            enum: ["demand", "negated", "training_offer", "unclear"],
          },
        },
        required: ["quote", "kind"],
      },
    },
  },
  required: [
    "companyName",
    "role",
    "salary",
    "location",
    "contacts",
    "links",
    "employerDomain",
    "claimedOperatingYears",
    "feeClaims",
  ],
};

/**
 * Extracts claims from posting text using Google Gemini API.
 * Uses structured JSON schema response constraints.
 * Throws GeminiQuotaError on rate limit / quota exhaustion.
 */
export async function extractClaimsWithGeminiKey(
  apiKey: string,
  postingText: string,
  timeoutMs = 15000
): Promise<{ extracted: ExtractedClaims; warnings: string[] }> {
  const env = getServerEnv();
  const configuredModel = env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const candidateModels = Array.from(
    new Set([configuredModel, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"])
  );

  const warnings: string[] = [];
  let lastError: Error | null = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const bodyPayload = {
      systemInstruction: {
        parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [{ text: postingText }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_EXTRACTED_CLAIMS_SCHEMA,
        temperature: 0,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
        lastError = new GeminiError("Gemini extraction timed out.", "timeout");
      } else {
        lastError = new GeminiError("Network error connecting to Gemini.", "network_error");
      }
      continue;
    }

    // Quota and rate limiting handling - don't retry models on same key if quota exhausted
    if (response.status === 429) {
      throw new GeminiQuotaError("Gemini rate limit or quota exceeded (HTTP 429).");
    }

    if (response.status === 401 || response.status === 403) {
      throw new GeminiError("Gemini authentication failed (invalid key or access denied).", "auth");
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      lastError = new GeminiError("Malformed JSON response from Gemini API.", "provider_error");
      continue;
    }

    if (data.error) {
      const errorMsg = data.error.message || JSON.stringify(data.error);
      const status = data.error.status || "";
      if (
        response.status === 429 ||
        status === "RESOURCE_EXHAUSTED" ||
        errorMsg.toLowerCase().includes("quota") ||
        errorMsg.toLowerCase().includes("rate limit")
      ) {
        throw new GeminiQuotaError(`Gemini quota exhausted: ${status || errorMsg}`);
      }

      // If high demand (503) or model unavailable (404), try next candidate model
      if (
        response.status === 503 ||
        response.status === 404 ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("not found") ||
        errorMsg.includes("no longer available")
      ) {
        lastError = new GeminiError(`Gemini API error (${model}): ${status || errorMsg}`, "provider_error");
        continue;
      }

      throw new GeminiError(`Gemini API error: ${status || errorMsg}`, "provider_error");
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      lastError = new GeminiError("No candidate response returned by Gemini.", "empty_response");
      continue;
    }

    if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
      throw new GeminiError(`Gemini blocked response due to ${candidate.finishReason}.`, "safety_refusal");
    }

    const rawJsonText = candidate.content?.parts?.[0]?.text;
    if (!rawJsonText || typeof rawJsonText !== "string") {
      lastError = new GeminiError("Empty text payload in Gemini candidate response.", "empty_response");
      continue;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawJsonText);
    } catch (err: any) {
      lastError = new GeminiError(`Failed to parse JSON extracted by Gemini: ${err.message}`, "invalid_json");
      continue;
    }

    // Runtime validation using the exact same Zod schema
    const validated = ExtractedClaimsSchema.parse(parsed);

    // Validate fee quotes against actual source text
    const validatedFeeClaims = validateFeeClaimsAgainstSource(
      validated.feeClaims,
      postingText
    );

    if (validatedFeeClaims.length < validated.feeClaims.length) {
      warnings.push(
        `Discarded ${
          validated.feeClaims.length - validatedFeeClaims.length
        } unverified/fabricated fee quote(s).`
      );
    }

    if (i > 0) {
      warnings.push(`Configured model ${candidateModels[0]} was unavailable (503); extracted using ${model}.`);
    }

    return {
      extracted: {
        ...validated,
        feeClaims: validatedFeeClaims,
      },
      warnings,
    };
  }

  throw lastError || new GeminiError("All candidate Gemini models failed.", "provider_error");
}
