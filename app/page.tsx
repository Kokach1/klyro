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
import { RiskDial } from "@/components/RiskDial";
import {
  calculateCoverage,
  deduplicateAndScoreSignals,
  evaluateVerdict,
  FIXED_DISCLAIMER,
  generateRuleSummary,
} from "@/lib/rules";

type AppStage = "input" | "review" | "results";

function setScanHash(hash: "review" | "results" | null) {
  const target = hash ? `#${hash}` : window.location.pathname;
  window.history.replaceState(null, "", target);
}

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
    complaints: "pending",
  });
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [verdictResult, setVerdictResult] = useState<VerdictResponse | null>(null);
  const [streamedChecks, setStreamedChecks] = useState<Partial<Record<CheckId, CheckResult>>>({});

  // Keep the in-progress score and coverage tied to the same streamed results.
  // Only completed checks can contribute risk signals, matching the final server result.
  const liveChecks = Object.values(streamedChecks).filter(
    (check): check is CheckResult => Boolean(check)
  );
  const liveCoverage = calculateCoverage(liveChecks);
  const { acceptedSignals: liveSignals, totalPoints: liveRiskIndex } = deduplicateAndScoreSignals(
    liveChecks.filter((check) => check.status === "completed").flatMap((check) => check.signals)
  );
  const liveVerdict = evaluateVerdict(liveChecks, liveSignals, liveRiskIndex);
  const returnedCheckCount = liveChecks.length;

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
      setScanHash("review");
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
    setVerdictResult(null);
    setStage("results");
    setScanHash("results");

    // Initialize all checks to pending
    const initialStates: Record<CheckId, "pending" | "running" | "done"> = {
      message_flags: "pending",
      domain_age: "pending",
      careers_match: "pending",
      complaints: "pending",
    };
    setCheckUiStates(initialStates);
    setStreamedChecks({});

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
              setStreamedChecks((prev) => ({ ...prev, [check.id]: check }));
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

        // Recompute local deterministic rules for interrupted stream: score from completed checks only
        const completedChecks = finalChecks.filter((c) => c.status === "completed");
        const rawSignals = completedChecks.flatMap((c) => c.signals);
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

  const handleStartNewScan = () => {
    setStage("input");
    setExtractSource(null);
    setExtractedClaims(null);
    setVerdictResult(null);
    setExtractError(null);
    setStreamInterrupted(false);
    setScanHash(null);
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
            <a href="/about" style={{ fontSize: "13px", fontWeight: 700, textDecoration: "underline" }}>
              About &amp; Methodology
            </a>
          </nav>
        </div>
        <p style={{ color: "#333333", fontSize: "15px", marginTop: "6px", fontWeight: 500 }}>
          Check a job post before you apply or pay. Evidence-backed. No AI guessing.
        </p>

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
              setScanHash(null);
            }}
            isRunningChecks={isRunningChecks}
          />
        )}

        {/* Verification in-progress monitor */}
        {stage === "results" && isRunningChecks && !verdictResult && (
          <section
            aria-labelledby="running-heading"
            className="nb-card"
            style={{ marginBottom: "28px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 id="running-heading" style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.3px" }}>
                  Running Verification Checks...
                </h2>
                <p style={{ fontSize: "14px", color: "#333333", marginTop: "4px" }}>
                  Executing 4 independent evidence checks concurrently across message signals, domain age, official careers portals, and scam complaints.
                </p>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  padding: "6px 14px",
                  backgroundColor: "var(--color-action)",
                  border: "2px solid #000000",
                  boxShadow: "3px 3px 0 #000000",
                }}
              >
                {liveCoverage.completed} of {liveCoverage.total} checks completed
              </span>
            </div>

            {/* Overall Progression Bar */}
            <div
              style={{
                width: "100%",
                height: "20px",
                backgroundColor: "#FFFFFF",
                border: "3px solid #000000",
                boxShadow: "3px 3px 0 #000000",
                marginBottom: "24px",
                overflow: "hidden",
              }}
            >
              <div
                className="nb-progress-striped"
                style={{
                  height: "100%",
                  backgroundColor: "var(--color-action)",
                  width: `${Math.max(15, (returnedCheckCount / CHECK_IDS_ORDERED.length) * 100)}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <div style={{ maxWidth: "300px", width: "100%" }}>
                <RiskDial
                  score={liveVerdict.riskIndex}
                  label={liveVerdict.label}
                  coverage={liveCoverage}
                />
                <p
                  style={{
                    marginTop: "10px",
                    fontSize: "12px",
                    color: "#555555",
                    lineHeight: "1.4",
                    textAlign: "center",
                  }}
                >
                  Live risk index and completed-check count update as each check returns. The final verdict is shown when all checks finish.
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                {
                  id: "message_flags" as CheckId,
                  title: "1. Message Red Flags",
                  desc: "Scanning for upfront payment demands, paid training fees, urgency, free webmail",
                },
                {
                  id: "domain_age" as CheckId,
                  title: "2. Employer Domain & Age",
                  desc: "Checking WHOIS domain creation date and 6-month contradiction",
                },
                {
                  id: "careers_match" as CheckId,
                  title: "3. Official Careers Match",
                  desc: "Verifying vacancy exists on official employer careers portal",
                },
                {
                  id: "complaints" as CheckId,
                  title: "4. Scam Complaints",
                  desc: "Scanning public sources for deduplicated complaint and allegation patterns",
                },
              ].map((checkDef) => {
                const uiState = checkUiStates[checkDef.id] || "pending";
                return (
                  <div
                    key={checkDef.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      backgroundColor: uiState === "done" ? "#F5FFF5" : uiState === "running" ? "#FFFDF5" : "#FFFFFF",
                      border: "2px solid #000000",
                      boxShadow: uiState === "running" ? "3px 3px 0 #000000" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#000000" }}>
                        {checkDef.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "#555555" }}>
                        {checkDef.desc}
                      </div>
                    </div>
                    <div>
                      {uiState === "done" && (
                        <span className="badge badge-safe">Done</span>
                      )}
                      {uiState === "running" && (
                        <span className="badge badge-running">Checking...</span>
                      )}
                      {uiState === "pending" && (
                        <span className="badge badge-neutral">Queued</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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
      </main>
    </div>
  );
}
