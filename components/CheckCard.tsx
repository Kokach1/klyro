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

  // Render status badge
  const renderStatusBadge = () => {
    if (uiState === "pending") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: "var(--border-divider)",
            color: "var(--text-secondary)",
          }}
        >
          Pending
        </span>
      );
    }

    if (uiState === "running") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: "var(--color-safe-bg)",
            color: "var(--color-action)",
          }}
        >
          <SpinnerIcon size={12} color="var(--color-action)" />
          Running
        </span>
      );
    }

    switch (check.status) {
      case "completed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--color-safe-bg)",
              color: "var(--color-action)",
            }}
          >
            <CheckCircleIcon size={13} color="var(--color-action)" />
            Completed
          </span>
        );
      case "inconclusive":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--color-caution-bg)",
              color: "var(--color-caution)",
            }}
          >
            <AlertTriangleIcon size={13} color="var(--color-caution)" />
            Inconclusive
          </span>
        );
      case "unavailable":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
            }}
          >
            <AlertCircleIcon size={13} color="var(--color-danger)" />
            Check unavailable
          </span>
        );
      case "not_applicable":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "var(--bg-color)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-divider)",
            }}
          >
            <MinusCircleIcon size={13} color="var(--text-secondary)" />
            Not applicable
          </span>
        );
    }
  };

  return (
    <article
      id={`card-${check.id}`}
      style={{
        backgroundColor: "var(--surface-color)",
        border: "1px solid var(--border-divider)",
        borderRadius: "var(--radius-card)",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-main)" }}>
          {title}
        </h3>
        {renderStatusBadge()}
      </div>

      {/* Main Finding */}
      <p
        style={{
          fontSize: "15px",
          color: "var(--text-main)",
          fontWeight: 500,
          marginBottom: "8px",
        }}
      >
        {check.finding}
      </p>

      {/* Reason for Inconclusive or Unavailable */}
      {check.reason && check.status !== "completed" && (
        <div
          style={{
            fontSize: "13px",
            color: check.status === "unavailable" ? "var(--color-danger)" : "var(--color-caution)",
            backgroundColor:
              check.status === "unavailable" ? "var(--color-danger-bg)" : "var(--color-caution-bg)",
            padding: "8px 10px",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        >
          <strong>Reason ({check.reasonCode}):</strong> {check.reason}
        </div>
      )}

      {/* Why it matters */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
          marginBottom: "12px",
        }}
      >
        <strong>Why it matters:</strong> {check.whyItMatters}
      </p>

      {/* Check metadata and toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          color: "var(--text-secondary)",
          borderTop: "1px solid var(--border-divider)",
          paddingTop: "10px",
        }}
      >
        <span>
          Checked: {check.checkedAt ? new Date(check.checkedAt).toLocaleTimeString() : "Pending"}
        </span>

        {check.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-action)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px",
            }}
          >
            <span>
              {isExpanded
                ? "Hide evidence"
                : `View supporting evidence (${check.evidence.length})`}
            </span>
            {isExpanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          </button>
        )}
      </div>

      {/* Expandable Supporting Evidence */}
      {isExpanded && check.evidence.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px dashed var(--border-divider)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {check.evidence.map((ev) => (
            <div
              key={ev.id}
              style={{
                backgroundColor: "var(--bg-color)",
                border: "1px solid var(--border-divider)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                  {ev.title}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: "var(--border-divider)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {ev.kind === "search_snippet"
                    ? "Search snippet only"
                    : ev.classification.replace("_", " ")}
                </span>
              </div>

              {ev.quote && (
                <p
                  style={{
                    fontStyle: "italic",
                    color: "var(--text-main)",
                    backgroundColor: "#FFFFFF",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-divider)",
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
                  color: "var(--text-secondary)",
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
                    }}
                  >
                    <span>Source link</span>
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
