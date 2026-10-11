import OpenAI from "openai";
import { getServerEnv } from "../env";
import {
  ExtractedClaims,
  ExtractedClaimsSchema,
  FeeClaim,
} from "../contracts";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EVALUATOR_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "../prompts";

/**
 * Validates fee claims quotes against the original source text.
 * Discards any fabricated quotes not present in the source text.
 */
export function validateFeeClaimsAgainstSource(
  feeClaims: FeeClaim[],
  sourceText: string
): FeeClaim[] {
  const normalizedSource = sourceText.replace(/\s+/g, " ");

  return feeClaims.filter((claim) => {
    if (!claim.quote || typeof claim.quote !== "string") return false;
    const quote = claim.quote.trim();
    if (quote.length === 0) return false;

    // Check exact match or normalized whitespace match
    if (sourceText.includes(quote)) return true;
    const normalizedQuote = quote.replace(/\s+/g, " ");
    return normalizedSource.includes(normalizedQuote);
  });
}

function getOpenAIClient(): { client: OpenAI; model: string } | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  return { client, model };
}

/**
 * Structured extraction of claims from job posting.
 * Rejects model refusal or missing key.
 */
export async function extractClaimsWithOpenAI(
  postingText: string,
  timeoutMs = 15000
): Promise<{ extracted: ExtractedClaims; warnings: string[] }> {
  const openAiSetup = getOpenAIClient();
  if (!openAiSetup) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const { client, model } = openAiSetup;
  const warnings: string[] = [];

  const jsonSchema = {
    name: "ExtractedClaims",
    strict: true,
    schema: {
      type: "object",
      properties: {
        companyName: { type: ["string", "null"] },
        role: { type: ["string", "null"] },
        salary: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["email", "phone", "other"] },
              value: { type: "string" },
            },
            required: ["kind", "value"],
            additionalProperties: false,
          },
        },
        links: {
          type: "array",
          items: { type: "string" },
        },
        employerDomain: { type: ["string", "null"] },
        claimedOperatingYears: { type: ["integer", "null"] },
        feeClaims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              quote: { type: "string" },
              kind: {
                type: "string",
                enum: ["demand", "negated", "training_offer", "unclear"],
              },
            },
            required: ["quote", "kind"],
            additionalProperties: false,
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
      additionalProperties: false,
    },
  };

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: postingText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
      temperature: 0,
    },
    {
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  const choice = response.choices?.[0];
  if (!choice || !choice.message || !choice.message.content) {
    throw new Error("Empty response or refusal from extraction model.");
  }

  if (choice.finish_reason === "length") {
    warnings.push("Extraction reached maximum tokens length.");
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(choice.message.content);
  } catch (err: any) {
    throw new Error(`Failed to parse extraction JSON: ${err.message}`);
  }

  // Ensure links and contacts do not exceed max schema limits
  if (parsedJson && typeof parsedJson === "object") {
    if (Array.isArray(parsedJson.links) && parsedJson.links.length > 10) {
      parsedJson.links = parsedJson.links.slice(0, 10);
    }
    if (Array.isArray(parsedJson.contacts) && parsedJson.contacts.length > 10) {
      parsedJson.contacts = parsedJson.contacts.slice(0, 10);
    }
  }

  // Runtime validation via Zod
  const validated = ExtractedClaimsSchema.parse(parsedJson);

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

  return {
    extracted: {
      ...validated,
      feeClaims: validatedFeeClaims,
    },
    warnings,
  };
}

/**
 * Summarize verdict with OpenAI, or throw so rules fallback is used.
 */
export async function summarizeVerdictWithOpenAI(
  payload: {
    label: string;
    riskIndex: number;
    coverage: any;
    signals: any[];
    checks: any[];
  },
  timeoutMs = 10000
): Promise<{ summary: string; nextSteps: string[] }> {
  const openAiSetup = getOpenAIClient();
  if (!openAiSetup) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const { client, model } = openAiSetup;

  const jsonSchema = {
    name: "VerdictSummary",
    strict: true,
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        nextSteps: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["summary", "nextSteps"],
      additionalProperties: false,
    },
  };

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
      temperature: 0.2,
    },
    {
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("Empty summary response from OpenAI.");
  }

  const parsed = JSON.parse(choice.message.content);
  return {
    summary: parsed.summary,
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3) : [],
  };
}
