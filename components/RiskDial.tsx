"use client";

import React from "react";
import { VerdictLabel } from "@/lib/contracts";

interface RiskDialProps {
  score: number | null; // 0..100, or null if rule evaluation failed
  label: VerdictLabel;
}

export function RiskDial({ score, label }: RiskDialProps) {
  // SVG Semicircular Arc Math
  // radius = 80, center = (100, 100)
  // angle 180 (left) to 0 (right)
  const radius = 75;
  const strokeWidth = 14;
  const center = 100;
  
  // Circumference of semi-circle = PI * r
  const arcLength = Math.PI * radius;

  // Normalized score 0 to 100
  const normalizedScore = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = arcLength - (arcLength * normalizedScore) / 100;

  let strokeColor = "#7FBC8C"; // safe
  if (label === "Caution") {
    strokeColor = "#FFB347";
  } else if (label === "Likely Scam") {
    strokeColor = "#FF6B6B";
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        border: "3px solid #000000",
        backgroundColor: "#FFFFFF",
        boxShadow: "4px 4px 0 #000000",
      }}
      aria-label={`Rule-based risk index: ${score !== null ? score : "Unavailable"}`}
    >
      <div style={{ position: "relative", width: "200px", height: "115px" }}>
        <svg
          width="200"
          height="120"
          viewBox="0 0 200 120"
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          {/* Background Track Arc */}
          <path
            d="M 25 100 A 75 75 0 0 1 175 100"
            fill="none"
            stroke="#E0E0E0"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          {/* Filled Risk Arc */}
          {score !== null && (
            <path
              d="M 25 100 A 75 75 0 0 1 175 100"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              style={{
                transition: "stroke-dashoffset 0.6s ease-out",
              }}
            />
          )}
        </svg>

        {/* Center score display */}
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            left: "0",
            right: "0",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "#000000",
              lineHeight: "1",
              display: "block",
              fontFamily: "var(--font-mono)",
            }}
          >
            {score !== null ? score : "N/A"}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "#555555",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Risk Index
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: "12px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 700,
            color: "#000000",
          }}
        >
          Rule-based risk index
        </span>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            color: "#555555",
            marginTop: "2px",
          }}
        >
          Higher = more observed risk signals. Not a probability.
        </span>
      </div>
    </div>
  );
}
