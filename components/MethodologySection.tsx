"use client";

import React from "react";
import { FIXED_DISCLAIMER } from "@/lib/rules";

export function MethodologySection() {
  return (
    <section
      id="methodology"
      aria-labelledby="methodology-heading"
      style={{
        backgroundColor: "var(--surface-color)",
        border: "1px solid var(--border-divider)",
        borderRadius: "var(--radius-card)",
        padding: "24px 20px",
        marginBottom: "32px",
      }}
    >
      <h2 id="methodology-heading" style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
        About & Methodology
      </h2>

      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "16px" }}>
        Job Scam Detector provides a deterministic, evidence-backed evaluation pipeline to detect common
        recruitment fraud patterns. It executes five bounded verification checks concurrently, scoring
        explicit signals rather than using probabilistic AI sentiment.
      </p>

      <h3 style={{ fontSize: "16px", fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>
        The Five Verification Checks
      </h3>
      <ul style={{ paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <li>
          <strong>1. Message red flags:</strong> Scans immutable source text for upfront payment demands,
          mandatory training fees, coercive urgency, and recruiters operating from free webmail providers. Negation phrases
          (such as &ldquo;no registration fee&rdquo;) are strictly preserved and never flagged as scam demands.
        </li>
        <li>
          <strong>2. Employer domain & age:</strong> Validates the employer&rsquo;s public registrable domain via WHOIS creation date
          math (evaluating calendar months with month-end and leap-year clamping). Flags domains under 6 months old that contradict claimed corporate longevity.
        </li>
        <li>
          <strong>3. Official careers-page match:</strong> Queries search engines and reads official employer careers portals
          to verify that the advertised vacancy actually exists on legitimate company channels.
        </li>
        <li>
          <strong>4. Indian corporate registration:</strong> Searches MCA records and corporate registries to discover Corporate Identification Numbers (CIN)
          and confirm active legal entity existence in India.
        </li>
        <li>
          <strong>5. Complaints & reviews:</strong> Bounded search across public web sources for recurring scam complaints. Requires 2+ independent,
          deduplicated sources to establish a pattern of reported allegations.
        </li>
      </ul>

      <h3 style={{ fontSize: "16px", fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>
        Deterministic Scoring & Verdict Gates
      </h3>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "12px" }}>
        Points are computed strictly from verified evidence. AI models never choose the label or invent confidence percentages:
      </p>
      <ul style={{ paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
        <li>
          <strong>Harmful-pattern override:</strong> Any directly evidenced candidate payment demand (80 pts) or mandatory paid training tied to a job (80 pts)
          immediately yields <em>Likely Scam</em>, regardless of company registration or external check availability.
        </li>
        <li>
          <strong>Safe gate:</strong> <em>Safe</em> is issued only when all core checks complete with zero scored risk signals, the domain is verified,
          the role is matched on the official careers portal, and no identity gaps exist.
        </li>
        <li>
          <strong>Caution default:</strong> In all other cases, the verdict defaults to <em>Caution</em>. An index of 0 with unverified external checks remains Caution.
        </li>
      </ul>

      <h3 style={{ fontSize: "16px", fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>
        Privacy & Data Handling
      </h3>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "16px" }}>
        This application operates strictly in-memory. Postings, contact information, and URLs are never stored in databases,
        local storage, query parameters, or server logs. Only extracted company names and domains are sent to search and WHOIS providers.
      </p>

      {/* Fixed Disclaimer */}
      <div style={{ paddingTop: "14px", borderTop: "1px solid var(--border-divider)", fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic" }}>
        <p>{FIXED_DISCLAIMER}</p>
      </div>
    </section>
  );
}
