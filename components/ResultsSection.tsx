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

  const { verdict, coverage, checks, nextSteps, disclaimer, mode, analyzedAt } = result;

  // Determine label theme
  let labelColor = "var(--color-action)";
  let labelBg = "var(--color-safe-bg)";
  let LabelIcon = CheckCircleIcon;

  if (verdict.label === "Caution") {
    labelColor = "var(--color-caution)";
    labelBg = "var(--color-caution-bg)";
    LabelIcon = AlertTriangleIcon;
  } else if (verdict.label === "Likely Scam") {
    labelColor = "var(--color-danger)";
    labelBg = "var(--color-danger-bg)";
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
      style={{
        marginBottom: "32px",
      }}
    >
      {/* Demo Fixture Persistent Banner */}
      {mode === "demo_fixture" && (
        <div
          role="note"
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #D97706",
            borderRadius: "var(--radius-card)",
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
            <AlertTriangleIcon size={18} color="#92400E" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#92400E" }}>
              Demo fixture - recorded evidence, not a live check
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "#92400E" }}>
            Recorded: {new Date(analyzedAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Interrupted Stream Notice */}
      {isStreamInterrupted && (
        <div
          role="alert"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-card)",
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
            <AlertCircleIcon size={18} color="var(--color-danger)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-danger)" }}>
              Stream connection was interrupted. Unfinished checks are marked unavailable.
            </span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                backgroundColor: "var(--color-danger)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
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
          marginBottom: "16px",
        }}
      >
        <h2 id="results-heading" style={{ fontSize: "22px", fontWeight: 700 }}>
          Verification results
        </h2>
        {onNewScan && (
          <button
            type="button"
            onClick={onNewScan}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-action)",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Start a new check
          </button>
        )}
      </div>

      {/* 1. Label + Dial + Coverage Grid Card */}
      <div
        style={{
          backgroundColor: "var(--surface-color)",
          border: "1px solid var(--border-divider)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            alignItems: "center",
          }}
        >
          {/* Section 1: Label & Qualifying Sentence */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                backgroundColor: labelBg,
                color: labelColor,
                fontSize: "16px",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              <LabelIcon size={20} color={labelColor} />
              <span>{verdict.label}</span>
            </div>

            <p
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--text-main)",
                lineHeight: "1.4",
                marginBottom: "12px",
              }}
            >
              {verdict.labelExplanation}
            </p>

            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              {verdict.summary}
            </p>
          </div>

          {/* Section 2: Rule-based risk index Dial */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RiskDial score={verdict.riskIndex} label={verdict.label} />
          </div>
        </div>

        {/* Section 3: Coverage */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-divider)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "14px",
          }}
        >
          <div>
            <strong>Coverage: </strong>
            <span>{coverage.completed} of 5 checks completed</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              flexWrap: "wrap",
            }}
          >
            {coverage.inconclusive > 0 && <span>{coverage.inconclusive} inconclusive</span>}
            {coverage.unavailable > 0 && <span>{coverage.unavailable} unavailable</span>}
            {coverage.notApplicable > 0 && <span>{coverage.notApplicable} not applicable</span>}
          </div>
        </div>
      </div>

      {/* Section 4: Main reasons (linked to cards) */}
      {allScoredSignals.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--surface-color)",
            border: "1px solid var(--border-divider)",
            borderRadius: "var(--radius-card)",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
            Main observed risk reasons
          </h3>
          <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {allScoredSignals.map(({ checkId, signal }, idx) => (
              <li key={idx} style={{ fontSize: "14px", lineHeight: "1.4" }}>
                <span>{signal.explanation} </span>
                <a href={`#card-${checkId}`} style={{ fontSize: "13px" }}>
                  (View check evidence)
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 5: Five Check Cards in Fixed Order */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
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

      {/* Section 6: Next Steps and Fixed Disclaimer */}
      <div
        style={{
          backgroundColor: "var(--surface-color)",
          border: "1px solid var(--border-divider)",
          borderRadius: "var(--radius-card)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
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

        {/* Fixed Disclaimer verbatim */}
        <div
          style={{
            paddingTop: "14px",
            borderTop: "1px solid var(--border-divider)",
            fontSize: "13px",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          <p>{disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
