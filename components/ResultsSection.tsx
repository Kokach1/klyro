"use client";

import React, { useEffect, useRef } from "react";
import { VerdictResponse, CheckResult, CheckId } from "@/lib/contracts";
import { RiskDial } from "./RiskDial";
import { CheckCard } from "./CheckCard";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
} from "./Icons";

interface ResultsSectionProps {
  result: VerdictResponse;
  checkUiStates?: Record<CheckId, "pending" | "running" | "done">;
  isStreamInterrupted?: boolean;
  onRetry?: () => void;
  onNewScan?: () => void;
}

export function ResultsSection({
  result,
  checkUiStates = {} as any,
  isStreamInterrupted = false,
  onRetry,
  onNewScan,
}: ResultsSectionProps) {
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const { verdict, coverage, checks, nextSteps, disclaimer } = result;

  // Determine label theme
  let labelBg = "#7FBC8C";   // safe
  let LabelIcon = CheckCircleIcon;
  if (verdict.label === "Caution") {
    labelBg = "#FFB347";
    LabelIcon = AlertTriangleIcon;
  } else if (verdict.label === "Likely Scam") {
    labelBg = "#FF6B6B";
    LabelIcon = AlertCircleIcon;
  }

  // Find all scored signals for the "Main reasons" section
  const allScoredSignals = checks.flatMap((c) =>
    c.signals.map((s) => ({ checkId: c.id, signal: s }))
  );

  return (
    <section
      id="results"
      ref={resultsRef}
      aria-labelledby="results-heading"
      style={{ marginBottom: "32px" }}
    >
      {/* Interrupted Stream Notice */}
      {isStreamInterrupted && (
        <div
          role="alert"
          style={{
            backgroundColor: "#FFE5E5",
            border: "3px solid var(--color-danger)",
            boxShadow: "4px 4px 0 #000000",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircleIcon size={18} color="#000000" />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#000000" }}>
              Stream connection was interrupted. Unfinished checks are marked unavailable.
            </span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary"
              style={{ fontSize: "13px", padding: "6px 14px", minHeight: "36px" }}
            >
              Retry checks
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "18px",
        }}
      >
        <h2 id="results-heading" style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.4px" }}>
          Verification results
        </h2>
        {onNewScan && (
          <button
            type="button"
            onClick={onNewScan}
            className="btn-primary"
            style={{ fontSize: "13px", padding: "6px 14px", minHeight: "36px" }}
          >
            New check
          </button>
        )}
      </div>

      {/* 1. Verdict Card */}
      <div className="nb-card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            alignItems: "center",
          }}
        >
          {/* Label & Summary */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                backgroundColor: labelBg,
                border: "3px solid #000000",
                boxShadow: "3px 3px 0 #000000",
                fontSize: "15px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "14px",
              }}
            >
              <LabelIcon size={18} color="#000000" />
              <span>{verdict.label}</span>
            </div>

            <p
              style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "#000000",
                lineHeight: "1.4",
                marginBottom: "12px",
              }}
            >
              {verdict.labelExplanation}
            </p>

            <p style={{ fontSize: "14px", color: "#333333", lineHeight: "1.5" }}>
              {verdict.summary}
            </p>
          </div>

          {/* Risk Dial */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RiskDial score={verdict.riskIndex} label={verdict.label} />
          </div>
        </div>

        {/* Coverage row */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "3px solid #000000",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "14px",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Coverage: <span style={{ fontWeight: 400 }}>{coverage.completed} of 5 checks completed</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              fontSize: "13px",
              color: "#555555",
              flexWrap: "wrap",
              fontFamily: "var(--font-mono)",
            }}
          >
            {coverage.inconclusive > 0 && <span>{coverage.inconclusive} inconclusive</span>}
            {coverage.unavailable > 0 && <span>{coverage.unavailable} unavailable</span>}
            {coverage.notApplicable > 0 && <span>{coverage.notApplicable} not applicable</span>}
          </div>
        </div>
      </div>

      {/* 2. Risk reasons */}
      {allScoredSignals.length > 0 && (
        <div className="nb-card" style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
            Main observed risk reasons
          </h3>
          <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {allScoredSignals.map(({ checkId, signal }, idx) => (
              <li key={idx} style={{ fontSize: "14px", lineHeight: "1.4" }}>
                <span>{signal.explanation} </span>
                <a href={`#card-${checkId}`} style={{ fontSize: "13px" }}>
                  (View evidence)
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Five Check Cards */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "18px" }}>
          Detailed verification checks
        </h3>
        {checks.map((check) => (
          <CheckCard
            key={check.id}
            check={check}
            uiState={checkUiStates[check.id] || "done"}
          />
        ))}
      </div>

      {/* 4. Next Steps + Disclaimer */}
      <div className="nb-card" style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
          Recommended next steps
        </h3>
        <ol
          style={{
            paddingLeft: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            fontSize: "14px",
            marginBottom: "18px",
          }}
        >
          {nextSteps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>

        <div
          style={{
            paddingTop: "14px",
            borderTop: "3px solid #000000",
            fontSize: "13px",
            color: "#444444",
            fontStyle: "italic",
          }}
        >
          <p>{disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
