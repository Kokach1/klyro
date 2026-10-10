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
  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
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
      throw new GeminiError("Gemini extraction timed out.", "timeout");
    }
    throw new GeminiError("Network error connecting to Gemini.", "network_error");
  }

  // Quota and rate limiting handling
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
    throw new GeminiError("Malformed JSON response from Gemini API.", "provider_error");
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
    throw new GeminiError(`Gemini API error: ${status || errorMsg}`, "provider_error");
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new GeminiError("No candidate response returned by Gemini.", "empty_response");
  }

  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
    throw new GeminiError(`Gemini blocked response due to ${candidate.finishReason}.`, "safety_refusal");
  }

  const rawJsonText = candidate.content?.parts?.[0]?.text;
  if (!rawJsonText || typeof rawJsonText !== "string") {
    throw new GeminiError("Empty text payload in Gemini candidate response.", "empty_response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (err: any) {
    throw new GeminiError(`Failed to parse JSON extracted by Gemini: ${err.message}`, "invalid_json");
  }

  // Runtime validation using the exact same Zod schema
  const validated = ExtractedClaimsSchema.parse(parsed);

  // Validate fee quotes against actual source text
  const warnings: string[] = [];
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

  return {
    extracted: {
      ...validated,
      feeClaims: validatedFeeClaims,
    },
    warnings,
  };
}
