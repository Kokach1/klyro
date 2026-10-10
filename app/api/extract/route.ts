import { NextRequest, NextResponse } from "next/server";
import { ExtractRequestSchema, ExtractResponse } from "@/lib/contracts";
import { safeFetchUrl, SafeFetchError } from "@/lib/safe-fetch";
import { extractClaimsWithOpenAI } from "@/lib/providers/openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServerEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  // Rate limit: 5 extract requests per IP per minute
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateCheck = checkRateLimit("extract", clientIp, 5, 60000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limit_exceeded",
          message: "Rate limit exceeded. Please wait a minute before analyzing another posting.",
          retryable: true,
        },
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "invalid_json",
          message: "Malformed JSON payload.",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const parsedRequest = ExtractRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsedRequest.error.errors.map((e) => e.message).join(", "),
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const { inputType, input } = parsedRequest.data;
  let sourceText = "";
  let sourceUrl: string | null = null;
  const warnings: string[] = [];

  if (inputType === "url") {
    if (input.length > 2048) {
      return NextResponse.json(
        {
          error: {
            code: "url_too_long",
            message: "URL exceeds the maximum length of 2,048 characters.",
            retryable: false,
          },
        },
        { status: 413 }
      );
    }

    try {
      const fetchResult = await safeFetchUrl(input, {
        timeoutMs: 8000,
        maxBytes: 1024 * 1024,
        maxRedirects: 3,
        maxTextChars: 8000,
      });
      sourceText = fetchResult.text;
      sourceUrl = fetchResult.finalUrl;
    } catch (err: any) {
      const isBlockedOrUnreadable =
        err instanceof SafeFetchError ||
        err.message?.includes("fetch") ||
        err.message?.includes("unsupported");

      return NextResponse.json(
        {
          error: {
            code: "url_unreadable",
            message: "We could not read this link. Paste the job text instead.",
            retryable: false,
          },
        },
        { status: 422 }
      );
    }

    if (!sourceText || sourceText.trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "empty_content",
            message: "We could not read this link. Paste the job text instead.",
            retryable: false,
          },
        },
        { status: 422 }
      );
    }
  } else {
    // Message text
    if (input.length > 20000) {
      return NextResponse.json(
        {
          error: {
            code: "text_too_long",
            message: "Posting text exceeds the maximum limit of 20,000 characters.",
            retryable: false,
          },
        },
        { status: 413 }
      );
    }
    sourceText = input.trim();
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "OPENAI_API_KEY is not configured on the server.",
          retryable: false,
        },
      },
      { status: 503 }
    );
  }

  try {
    const { extracted, warnings: extractionWarnings } =
      await extractClaimsWithOpenAI(sourceText, 15000);

    const responseData: ExtractResponse = {
      source: {
        inputType,
        url: sourceUrl,
        text: sourceText,
        retrievedAt: new Date().toISOString(),
      },
      extracted,
      warnings: [...warnings, ...extractionWarnings],
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          code: "extraction_failed",
          message: `Extraction failed: ${err.message}`,
          retryable: true,
        },
      },
      { status: 422 }
    );
  }
}
