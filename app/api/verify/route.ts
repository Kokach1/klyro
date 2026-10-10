import { NextRequest, NextResponse } from "next/server";
import {
  CheckId,
  CHECK_IDS_ORDERED,
  CheckResult,
  ReasonCode,
  Signal,
  VerdictResponse,
  VerifyRequestSchema,
} from "@/lib/contracts";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkMessageFlags } from "@/lib/checks/message-flags";
import { checkDomainAge } from "@/lib/checks/domain-age";
import { checkCareersMatch } from "@/lib/checks/careers-match";
import { checkRegistration } from "@/lib/checks/registration";
import { checkComplaints } from "@/lib/checks/complaints";
import {
  calculateCoverage,
  deduplicateAndScoreSignals,
  evaluateVerdict,
  FIXED_DISCLAIMER,
  generateRuleSummary,
} from "@/lib/rules";
import { summarizeVerdictWithOpenAI } from "@/lib/providers/openai";

export const maxDuration = 60; // route budget on Vercel

/**
 * Creates an unavailable fallback CheckResult if a check fails or times out.
 */
function createUnavailableCheck(
  id: CheckId,
  reasonCode: ReasonCode,
  reason: string
): CheckResult {
  return {
    id,
    status: "unavailable",
    reasonCode,
    reason,
    finding: `Check unavailable: ${reason}`,
    whyItMatters: "External verification could not complete within the safety deadline.",
    checkedAt: new Date().toISOString(),
    evidence: [],
    signals: [],
    facts: {
      domain: null,
      domainOfficialConfirmed: false,
      domainResponse: null,
      domainCreatedAt: null,
      domainAgeDays: null,
      domainYoung: null,
      roleMatched: null,
      legalName: null,
      cin: null,
      identityMatch: "ambiguous",
    },
  };
}

export async function POST(req: NextRequest) {
  // Rate limiting: 5 verify requests per IP per minute
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateCheck = checkRateLimit("verify", clientIp, 5, 60000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limit_exceeded",
          message: "Rate limit exceeded. Please wait a minute before verifying another posting.",
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

  const parsedRequest = VerifyRequestSchema.safeParse(body);
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

  const { source, extracted } = parsedRequest.data;
  const analysisDate = new Date();
  const acceptHeader = req.headers.get("accept") || "";
  const wantsNdjson = acceptHeader.includes("application/x-ndjson");

  // If streaming is requested via NDJSON:
  if (wantsNdjson) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const writeEvent = async (event: any) => {
      try {
        await writer.write(encoder.encode(JSON.stringify(event) + "\n"));
      } catch {
        // Stream aborted or client disconnected
      }
    };

    // Orchestrate checks in background
    (async () => {
      try {
        // Emit start events for all five checks
        for (const checkId of CHECK_IDS_ORDERED) {
          await writeEvent({ type: "check_started", checkId });
        }

        // Run checks concurrently with 15s budget each
        const runCheckWithBudget = async (
          id: CheckId,
          fn: () => Promise<CheckResult> | CheckResult
        ): Promise<CheckResult> => {
          try {
            const timeoutPromise = new Promise<CheckResult>((_, reject) =>
              setTimeout(() => reject(new Error("Check execution timed out")), 15000)
            );
            const check = await Promise.race([Promise.resolve(fn()), timeoutPromise]);
            await writeEvent({ type: "check_result", check });
            return check;
          } catch (err: any) {
            const isTimeout = err.message?.includes("timed out");
            const fallback = createUnavailableCheck(
              id,
              isTimeout ? "timeout" : "provider_error",
              err.message || "Execution failed."
            );
            await writeEvent({ type: "check_result", check: fallback });
            return fallback;
          }
        };

        const [
          messageCheck,
          domainCheck,
          careersCheck,
          registrationCheck,
          complaintsCheck,
        ] = await Promise.all([
          runCheckWithBudget("message_flags", () => checkMessageFlags(source, extracted)),
          runCheckWithBudget("domain_age", () => checkDomainAge(extracted, analysisDate)),
          runCheckWithBudget("careers_match", () => checkCareersMatch(extracted, analysisDate)),
          runCheckWithBudget("registration", () => checkRegistration(extracted, analysisDate)),
          runCheckWithBudget("complaints", () => checkComplaints(extracted, analysisDate)),
        ]);

        const checks: CheckResult[] = [
          messageCheck,
          domainCheck,
          careersCheck,
          registrationCheck,
          complaintsCheck,
        ];

        // Scoring and coverage
        const rawSignals: Signal[] = checks.flatMap((c) => c.signals);
        const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
        const coverage = calculateCoverage(checks);
        const verdictBase = evaluateVerdict(checks, acceptedSignals, totalPoints);

        // Summary stage: Try OpenAI with 10s budget, fallback to rules
        let summaryText = "";
        let nextStepsList: string[] = [];
        let summarySource: "model" | "rules" = "rules";

        try {
          const aiSummary = await summarizeVerdictWithOpenAI(
            {
              label: verdictBase.label,
              riskIndex: verdictBase.riskIndex,
              coverage,
              signals: acceptedSignals,
              checks,
            },
            10000
          );
          summaryText = aiSummary.summary;
          nextStepsList = aiSummary.nextSteps;
          summarySource = "model";
        } catch {
          const ruleSummary = generateRuleSummary(
            verdictBase.label,
            verdictBase.ruleId,
            verdictBase.riskIndex,
            coverage,
            acceptedSignals,
            checks
          );
          summaryText = ruleSummary.summary;
          nextStepsList = ruleSummary.nextSteps;
          summarySource = "rules";
        }

        const finalResponse: VerdictResponse = {
          schemaVersion: "1.0",
          mode: "live",
          analyzedAt: analysisDate.toISOString(),
          extracted,
          verdict: {
            label: verdictBase.label,
            ruleId: verdictBase.ruleId,
            riskIndex: verdictBase.riskIndex,
            labelExplanation: verdictBase.labelExplanation,
            summary: summaryText,
            summarySource,
          },
          coverage,
          checks,
          nextSteps: nextStepsList,
          disclaimer: FIXED_DISCLAIMER,
        };

        await writeEvent({ type: "final", result: finalResponse });
      } catch (err: any) {
        // Interrupted stream handling
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  // Standard JSON response
  try {
    const runCheckSafely = async (
      id: CheckId,
      fn: () => Promise<CheckResult> | CheckResult
    ): Promise<CheckResult> => {
      try {
        const timeoutPromise = new Promise<CheckResult>((_, reject) =>
          setTimeout(() => reject(new Error("Check execution timed out")), 15000)
        );
        return await Promise.race([Promise.resolve(fn()), timeoutPromise]);
      } catch (err: any) {
        return createUnavailableCheck(
          id,
          err.message?.includes("timed out") ? "timeout" : "provider_error",
          err.message || "Execution failed."
        );
      }
    };

    const checks = await Promise.all([
      runCheckSafely("message_flags", () => checkMessageFlags(source, extracted)),
      runCheckSafely("domain_age", () => checkDomainAge(extracted, analysisDate)),
      runCheckSafely("careers_match", () => checkCareersMatch(extracted, analysisDate)),
      runCheckSafely("registration", () => checkRegistration(extracted, analysisDate)),
      runCheckSafely("complaints", () => checkComplaints(extracted, analysisDate)),
    ]);

    const rawSignals: Signal[] = checks.flatMap((c) => c.signals);
    const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
    const coverage = calculateCoverage(checks);
    const verdictBase = evaluateVerdict(checks, acceptedSignals, totalPoints);

    let summaryText = "";
    let nextStepsList: string[] = [];
    let summarySource: "model" | "rules" = "rules";

    try {
      const aiSummary = await summarizeVerdictWithOpenAI(
        {
          label: verdictBase.label,
          riskIndex: verdictBase.riskIndex,
          coverage,
          signals: acceptedSignals,
          checks,
        },
        10000
      );
      summaryText = aiSummary.summary;
      nextStepsList = aiSummary.nextSteps;
      summarySource = "model";
    } catch {
      const ruleSummary = generateRuleSummary(
        verdictBase.label,
        verdictBase.ruleId,
        verdictBase.riskIndex,
        coverage,
        acceptedSignals,
        checks
      );
      summaryText = ruleSummary.summary;
      nextStepsList = ruleSummary.nextSteps;
      summarySource = "rules";
    }

    const finalResponse: VerdictResponse = {
      schemaVersion: "1.0",
      mode: "live",
      analyzedAt: analysisDate.toISOString(),
      extracted,
      verdict: {
        label: verdictBase.label,
        ruleId: verdictBase.ruleId,
        riskIndex: verdictBase.riskIndex,
        labelExplanation: verdictBase.labelExplanation,
        summary: summaryText,
        summarySource,
      },
      coverage,
      checks,
      nextSteps: nextStepsList,
      disclaimer: FIXED_DISCLAIMER,
    };

    return NextResponse.json(finalResponse, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          code: "verification_error",
          message: err.message || "An unexpected error occurred during verification.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
