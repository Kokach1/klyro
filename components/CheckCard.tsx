"use client";

import React, { useState } from "react";
import { CheckResult, CheckId } from "@/lib/contracts";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  MinusCircleIcon,
  SpinnerIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
} from "./Icons";

interface CheckCardProps {
  check: CheckResult;
  uiState?: "pending" | "running" | "done";
}

const CHECK_TITLES: Record<CheckId, string> = {
  message_flags: "Message red flags",
  domain_age: "Company domain and age",
  careers_match: "Official careers-page match",
  registration: "Indian company registration",
  complaints: "Complaints and reviews",
};

export function CheckCard({ check, uiState = "done" }: CheckCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const title = CHECK_TITLES[check.id] || check.id;
  const isCorroborated = check.tier === "corroborated";

  // Render status badge
  const renderStatusBadge = () => {
    if (uiState === "pending") {
      return <span className="badge badge-neutral">Pending</span>;
    }

    if (uiState === "running") {
      return (
        <span className="badge badge-running">
          <SpinnerIcon size={11} color="#000000" />
          Running
        </span>
      );
    }

    if (isCorroborated) {
      return (
        <span
          className="badge badge-caution"
          style={{
            backgroundColor: "var(--color-caution)",
            color: "#000000",
            border: "2px solid #000000",
          }}
        >
          <AlertTriangleIcon size={12} color="#000000" />
          Corroborated (search-based)
        </span>
      );
    }

    if (check.tier === "verified" || (!check.tier && check.status === "completed")) {
      return (
        <span className="badge badge-safe">
          <CheckCircleIcon size={12} color="#000000" />
          Verified
        </span>
      );
    }

    switch (check.status) {
      case "completed":
        return (
          <span className="badge badge-safe">
            <CheckCircleIcon size={12} color="#000000" />
            Verified
          </span>
        );
      case "inconclusive":
        return (
          <span className="badge badge-caution">
            <AlertTriangleIcon size={12} color="#000000" />
            Inconclusive
          </span>
        );
      case "unavailable":
        return (
          <span className="badge badge-danger">
            <AlertCircleIcon size={12} color="#000000" />
            Unavailable
          </span>
        );
      case "not_applicable":
        return (
          <span className="badge badge-neutral">
            <MinusCircleIcon size={12} color="#000000" />
            Not applicable
          </span>
        );
    }
  };

  return (
    <article
      id={`card-${check.id}`}
      className="nb-card"
      style={{
        marginBottom: "20px",
        ...(isCorroborated
          ? {
              borderLeft: "8px solid var(--color-caution)",
              boxShadow: "6px 6px 0 var(--color-caution)",
              backgroundColor: "#FFFDF2",
            }
          : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#000000" }}>
          {title}
        </h3>
        {renderStatusBadge()}
      </div>

      {/* Honest Tier Indication for Corroborated */}
      {isCorroborated && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            backgroundColor: "var(--color-caution)",
            border: "2px solid #000000",
            padding: "3px 8px",
            marginBottom: "10px",
            boxShadow: "2px 2px 0 #000000",
          }}
        >
          <span>Search-based evidence</span>
          <span style={{ fontWeight: 400 }}>•</span>
          <span style={{ fontWeight: 600 }}>Target page was not directly read</span>
        </div>
      )}

      {/* Main Finding */}
      <p
        style={{
          fontSize: "15px",
          color: "#000000",
          fontWeight: 600,
          marginBottom: "8px",
          lineHeight: "1.4",
        }}
      >
        {check.finding}
      </p>

      {/* Reason for Inconclusive or Unavailable */}
      {check.reason && check.status !== "completed" && (
        <div
          style={{
            fontSize: "13px",
            color: "#000000",
            backgroundColor:
              check.status === "unavailable" ? "#FFE5E5" : "#FFF3E0",
            padding: "8px 10px",
            border: `3px solid ${check.status === "unavailable" ? "var(--color-danger)" : "var(--color-caution)"}`,
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          Reason ({check.reasonCode}): {check.reason}
        </div>
      )}

      {/* Why it matters */}
      <p
        style={{
          fontSize: "13px",
          color: "#333333",
          lineHeight: "1.5",
          marginBottom: "14px",
          borderLeft: "3px solid #000000",
          paddingLeft: "8px",
        }}
      >
        <strong>Why it matters: </strong>{check.whyItMatters}
      </p>

      {/* Check metadata and toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "#555555",
          borderTop: "2px solid #000000",
          paddingTop: "10px",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>
          Checked: {check.checkedAt ? new Date(check.checkedAt).toLocaleTimeString() : "Pending"}
        </span>

        {check.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-ghost"
            style={{ fontFamily: "var(--font-family)" }}
          >
            <span>
              {isExpanded
                ? "Hide evidence"
                : `View evidence (${check.evidence.length})`}
            </span>
            {isExpanded ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
          </button>
        )}
      </div>

      {/* Expandable Supporting Evidence */}
      {isExpanded && check.evidence.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "2px dashed #000000",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {check.evidence.map((ev) => (
            <div
              key={ev.id}
              style={{
                backgroundColor: "#FFFDF5",
                border: "2px solid #000000",
                padding: "10px 12px",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "6px",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 700, color: "#000000" }}>
                  {ev.title}
                </span>
                <span className="badge badge-neutral" style={{ flexShrink: 0 }}>
                  {ev.kind === "search_snippet"
                    ? "Search snippet only"
                    : ev.classification.replace("_", " ")}
                </span>
              </div>

              {ev.quote && (
                <p
                  style={{
                    fontStyle: "italic",
                    color: "#000000",
                    backgroundColor: "#FFFFFF",
                    padding: "6px 8px",
                    border: "2px solid #000000",
                    marginBottom: "6px",
                    wordBreak: "break-word",
                  }}
                >
                  &ldquo;{ev.quote}&rdquo;
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#555555",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span>Provider: {ev.provider || "Direct input quote"}</span>
                {ev.url && (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span>Source</span>
                    <ExternalLinkIcon size={11} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
