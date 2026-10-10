"use client";

import React, { useState, useEffect } from "react";
import {
  ExtractResponse,
  ExtractedClaims,
  ExtractSource,
  VerdictResponse,
  CheckId,
  CHECK_IDS_ORDERED,
  CheckResult,
} from "@/lib/contracts";
import { InputForm } from "@/components/InputForm";
import { ClaimReview } from "@/components/ClaimReview";
import { ResultsSection } from "@/components/ResultsSection";
import { MethodologySection } from "@/components/MethodologySection";
import {
  FIXTURE_OFFICIAL_ROLE,
  FIXTURE_PAYMENT_FORWARD,
  FIXTURE_PAID_COURSE,
  FIXTURE_UNAVAILABLE_PROVIDERS,
} from "@/fixtures/demo-cases";
import {
  calculateCoverage,
  deduplicateAndScoreSignals,
  evaluateVerdict,
  FIXED_DISCLAIMER,
  generateRuleSummary,
} from "@/lib/rules";

type AppStage = "input" | "review" | "results";

export default function Home() {
  const [stage, setStage] = useState<AppStage>("input");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Extracted data state
  const [extractSource, setExtractSource] = useState<ExtractSource | null>(null);
  const [extractedClaims, setExtractedClaims] = useState<ExtractedClaims | null>(null);

  // Verification state
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [checkUiStates, setCheckUiStates] = useState<Record<CheckId, "pending" | "running" | "done">>({
    message_flags: "pending",
    domain_age: "pending",
    careers_match: "pending",
    registration: "pending",
    complaints: "pending",
  });
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [verdictResult, setVerdictResult] = useState<VerdictResponse | null>(null);

  // Handle URL hash routing on initial load
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === "#review" && !extractedClaims) {
        setStage("input");
      } else if (hash === "#results" && !verdictResult) {
        setStage("input");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [extractedClaims, verdictResult]);

  // Stage 1: Extraction handler
  const handleAnalyze = async (inputType: "text" | "url", input: string) => {
    setIsExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType, input }),
      });

      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error?.message || "Failed to analyze posting.");
        return;
      }

      const response = data as ExtractResponse;
      setExtractSource(response.source);
      setExtractedClaims(response.extracted);
      setStage("review");
      window.location.hash = "review";
    } catch (err: any) {
      setExtractError(err.message || "Network error while connecting to extraction service.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Stage 2: Verification stream handler
  const handleRunChecks = async (claimsToVerify: ExtractedClaims) => {
    if (!extractSource) return;

    setIsRunningChecks(true);
    setStreamInterrupted(false);
    setStage("results");
    window.location.hash = "results";

    // Initialize all checks to pending
    const initialStates: Record<CheckId, "pending" | "running" | "done"> = {
      message_flags: "pending",
      domain_age: "pending",
      careers_match: "pending",
      registration: "pending",
      complaints: "pending",
    };
    setCheckUiStates(initialStates);

    const receivedChecks: CheckResult[] = [];

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          source: extractSource,
          extracted: claimsToVerify,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Verification request failed.");
      }

      if (!res.body) {
        throw new Error("No readable stream response from verification service.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "check_started") {
              setCheckUiStates((prev) => ({ ...prev, [event.checkId]: "running" }));
            } else if (event.type === "check_result") {
              const check: CheckResult = event.check;
              receivedChecks.push(check);
              setCheckUiStates((prev) => ({ ...prev, [check.id]: "done" }));
            } else if (event.type === "final") {
              setVerdictResult(event.result);
              setIsRunningChecks(false);
              return;
            }
          } catch {
            // malformed line
          }
        }
      }

      // If stream ended without final event (interrupted stream):
      if (!verdictResult && receivedChecks.length > 0) {
        setStreamInterrupted(true);
        // Build completed/interrupted checks array
        const finalChecks: CheckResult[] = CHECK_IDS_ORDERED.map((id) => {
          const found = receivedChecks.find((c) => c.id === id);
          if (found) return found;
          return {
            id,
            status: "unavailable",
            reasonCode: "interrupted",
            reason: "Stream was interrupted before check completed.",
            finding: "Check unavailable: stream connection was interrupted.",
            whyItMatters: "External verification was not finalized.",
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
        });

        // Recompute local deterministic rules for interrupted stream
        const rawSignals = finalChecks.flatMap((c) => c.signals);
        const { acceptedSignals, totalPoints } = deduplicateAndScoreSignals(rawSignals);
        const coverage = calculateCoverage(finalChecks);
        const verdictBase = evaluateVerdict(finalChecks, acceptedSignals, totalPoints);
        const ruleSummary = generateRuleSummary(
          verdictBase.label,
          verdictBase.ruleId,
          verdictBase.riskIndex,
          coverage,
          acceptedSignals,
          finalChecks
        );

        setVerdictResult({
          schemaVersion: "1.0",
          mode: "live",
          analyzedAt: new Date().toISOString(),
          extracted: claimsToVerify,
          verdict: {
            label: verdictBase.label,
            ruleId: verdictBase.ruleId,
            riskIndex: verdictBase.riskIndex,
            labelExplanation: verdictBase.labelExplanation,
            summary: ruleSummary.summary,
            summarySource: "rules",
          },
          coverage,
          checks: finalChecks,
          nextSteps: ruleSummary.nextSteps,
          disclaimer: FIXED_DISCLAIMER,
        });
      }
    } catch (err: any) {
      setStreamInterrupted(true);
    } finally {
      setIsRunningChecks(false);
    }
  };

  // Demo fixture loader
  const handleLoadFixture = (fixture: VerdictResponse) => {
    setExtractSource({
      inputType: "text",
      url: null,
      text: "Demo fixture source text.",
      retrievedAt: fixture.analyzedAt,
    });
    setExtractedClaims(fixture.extracted);
    setVerdictResult(fixture);
    setStage("results");
    window.location.hash = "results";
  };

  const handleStartNewScan = () => {
    setStage("input");
    setExtractSource(null);
    setExtractedClaims(null);
    setVerdictResult(null);
    setExtractError(null);
    setStreamInterrupted(false);
    window.location.hash = "";
  };

  return (
    <div style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "28px 16px" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "3px solid #000000",
          paddingBottom: "18px",
          marginBottom: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#000000", letterSpacing: "-0.5px" }}>
            Job Scam Detector
          </h1>
          <nav aria-label="Quick links">
            <a href="#methodology" style={{ fontSize: "13px", fontWeight: 700, textDecoration: "underline" }}>
              Methodology
            </a>
          </nav>
        </div>
        <p style={{ color: "#333333", fontSize: "15px", marginTop: "6px", fontWeight: 500 }}>
          Check a job post before you apply or pay. Evidence-backed. No AI guessing.
        </p>

        {/* Demo Fixtures Quick Links */}
        <div
          style={{
            marginTop: "14px",
            padding: "10px 14px",
            backgroundColor: "#FFFFFF",
            border: "3px solid #000000",
            boxShadow: "4px 4px 0 #000000",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            fontSize: "13px",
          }}
        >
          <span style={{ fontWeight: 700, color: "#000000" }}>
            Load demo:
          </span>
          <button
            type="button"
            onClick={() => handleLoadFixture(FIXTURE_OFFICIAL_ROLE)}
            style={{
              padding: "4px 10px",
              border: "2px solid #000000",
              backgroundColor: "#7FBC8C",
              color: "#000000",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Official role (Safe)
          </button>
          <button
            type="button"
            onClick={() => handleLoadFixture(FIXTURE_PAYMENT_FORWARD)}
            style={{
              padding: "4px 10px",
              border: "2px solid #000000",
              backgroundColor: "#FF6B6B",
              color: "#000000",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Payment demand (Scam)
          </button>
          <button
            type="button"
            onClick={() => handleLoadFixture(FIXTURE_PAID_COURSE)}
            style={{
              padding: "4px 10px",
              border: "2px solid #000000",
              backgroundColor: "#FFB347",
              color: "#000000",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Paid training (Caution)
          </button>
          <button
            type="button"
            onClick={() => handleLoadFixture(FIXTURE_UNAVAILABLE_PROVIDERS)}
            style={{
              padding: "4px 10px",
              border: "2px solid #000000",
              backgroundColor: "#E0E0E0",
              color: "#000000",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Missing keys (Unavailable)
          </button>
        </div>
      </header>

      {/* Screen Reader Progress Announcements */}
      <div aria-live="polite" className="sr-only" style={{ position: "absolute", left: "-9999px" }}>
        {isExtracting && "Extracting claims from posting..."}
        {isRunningChecks && "Running verification checks across domain, careers, registry, and complaints..."}
      </div>

      {/* Main Flow Controller */}
      <main>
        {stage === "input" && (
          <InputForm
            onAnalyze={handleAnalyze}
            isLoading={isExtracting}
            serverError={extractError}
            onClearError={() => setExtractError(null)}
          />
        )}

        {stage === "review" && extractSource && extractedClaims && (
          <ClaimReview
            source={extractSource}
            extracted={extractedClaims}
            onRunChecks={handleRunChecks}
            onEditPosting={() => {
              setStage("input");
              window.location.hash = "";
            }}
            isRunningChecks={isRunningChecks}
          />
        )}

        {stage === "results" && verdictResult && (
          <ResultsSection
            result={verdictResult}
            checkUiStates={checkUiStates}
            isStreamInterrupted={streamInterrupted}
            onRetry={() => extractedClaims && handleRunChecks(extractedClaims)}
            onNewScan={handleStartNewScan}
          />
        )}

        {/* Anchor without state empty fallback */}
        {stage === "review" && !extractedClaims && (
          <div
            className="nb-card"
            style={{ textAlign: "center", marginBottom: "24px" }}
          >
            <p style={{ marginBottom: "14px", color: "#333333" }}>
              No check in this session.
            </p>
            <button
              type="button"
              onClick={handleStartNewScan}
              className="btn-primary"
            >
              Start a check
            </button>
          </div>
        )}

        {stage === "results" && !verdictResult && !isRunningChecks && (
          <div
            className="nb-card"
            style={{ textAlign: "center", marginBottom: "24px" }}
          >
            <p style={{ marginBottom: "14px", color: "#333333" }}>
              No check in this session.
            </p>
            <button
              type="button"
              onClick={handleStartNewScan}
              className="btn-primary"
            >
              Start a check
            </button>
          </div>
        )}

        {/* Methodology Section (accessible at all times) */}
        <MethodologySection />
      </main>
    </div>
  );
}
