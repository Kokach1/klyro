"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExtractedClaims, ExtractSource, ContactItem } from "@/lib/contracts";
import { AlertCircleIcon, SpinnerIcon } from "./Icons";

interface ClaimReviewProps {
  source: ExtractSource;
  extracted: ExtractedClaims;
  onRunChecks: (updatedClaims: ExtractedClaims) => Promise<void>;
  onEditPosting: () => void;
  isRunningChecks: boolean;
}

export function ClaimReview({
  source,
  extracted,
  onRunChecks,
  onEditPosting,
  isRunningChecks,
}: ClaimReviewProps) {
  const [claims, setClaims] = useState<ExtractedClaims>(extracted);
  const [showSourceText, setShowSourceText] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Focus the review heading after mount
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, []);

  const handleFieldChange = (field: keyof ExtractedClaims, value: any) => {
    setClaims((prev) => ({
      ...prev,
      [field]: value === "" ? null : value,
    }));
    setValidationError(null);
  };

  const handleContactChange = (index: number, key: keyof ContactItem, val: string) => {
    const updated = [...claims.contacts];
    updated[index] = { ...updated[index], [key]: val };
    setClaims((prev) => ({ ...prev, contacts: updated }));
  };

  const handleAddContact = () => {
    if (claims.contacts.length >= 10) return;
    setClaims((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { kind: "email", value: "" }],
    }));
  };

  const handleRemoveContact = (index: number) => {
    setClaims((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const handleLinkChange = (index: number, val: string) => {
    const updated = [...claims.links];
    updated[index] = val;
    setClaims((prev) => ({ ...prev, links: updated }));
  };

  const handleAddLink = () => {
    if (claims.links.length >= 10) return;
    setClaims((prev) => ({
      ...prev,
      links: [...prev.links, ""],
    }));
  };

  const handleRemoveLink = (index: number) => {
    setClaims((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasCompany = claims.companyName && claims.companyName.trim().length > 0;
    const hasRole = claims.role && claims.role.trim().length > 0;

    if (!hasCompany && !hasRole) {
      setValidationError("At least company name or role is required to run verification checks.");
      return;
    }

    onRunChecks(claims);
  };

  return (
    <section
      id="review"
      aria-labelledby="review-section-heading"
      style={{
        backgroundColor: "var(--surface-color)",
        border: "1px solid var(--border-divider)",
        borderRadius: "var(--radius-card)",
        padding: "24px 20px",
        marginBottom: "24px",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h2
          id="review-section-heading"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "20px", fontWeight: 600, outline: "none", marginBottom: "8px" }}
        >
          Review extracted claims
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          Confirm or correct extracted details before verification. Note that original message
          text remains immutable for quote-based risk signals.
        </p>
      </div>

      {/* Immutable Source Disclosure */}
      <div
        style={{
          border: "1px solid var(--border-divider)",
          borderRadius: "var(--radius-sm)",
          padding: "12px",
          marginBottom: "20px",
          backgroundColor: "var(--bg-color)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Original source text ({source.inputType === "url" ? "Fetched URL" : "Message text"})
          </span>
          <button
            type="button"
            onClick={() => setShowSourceText(!showSourceText)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-action)",
              fontSize: "13px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            {showSourceText ? "Hide source text" : "View source text"}
          </button>
        </div>
        {showSourceText && (
          <div style={{ marginTop: "10px" }}>
            {source.url && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom: "6px",
                  wordBreak: "break-all",
                }}
              >
                Source URL: {source.url}
              </p>
            )}
            <pre
              style={{
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: "200px",
                overflowY: "auto",
                backgroundColor: "#FFFFFF",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid var(--border-divider)",
              }}
            >
              {source.text}
            </pre>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* Company Name */}
          <div>
            <label
              htmlFor="field-company"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Company name *
            </label>
            <input
              id="field-company"
              type="text"
              value={claims.companyName ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("companyName", e.target.value)}
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="field-role"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Job role *
            </label>
            <input
              id="field-role"
              type="text"
              value={claims.role ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("role", e.target.value)}
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
          </div>

          {/* Employer Domain */}
          <div>
            <label
              htmlFor="field-domain"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Employer domain candidate
            </label>
            <input
              id="field-domain"
              type="text"
              value={claims.employerDomain ?? ""}
              placeholder="Unknown (e.g. acme.com)"
              onChange={(e) => handleFieldChange("employerDomain", e.target.value)}
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: "4px" }}>
              Do not enter a free-email provider or job board.
            </span>
          </div>

          {/* Salary */}
          <div>
            <label
              htmlFor="field-salary"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Salary / Compensation
            </label>
            <input
              id="field-salary"
              type="text"
              value={claims.salary ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("salary", e.target.value)}
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="field-location"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Location
            </label>
            <input
              id="field-location"
              type="text"
              value={claims.location ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("location", e.target.value)}
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
          </div>

          {/* Claimed Operating Years */}
          <div>
            <label
              htmlFor="field-years"
              style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}
            >
              Claimed operating history (years)
            </label>
            <input
              id="field-years"
              type="number"
              min="0"
              max="200"
              value={claims.claimedOperatingYears ?? ""}
              placeholder="Unknown"
              onChange={(e) =>
                handleFieldChange(
                  "claimedOperatingYears",
                  e.target.value === "" ? null : parseInt(e.target.value, 10)
                )
              }
              disabled={isRunningChecks}
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-divider)",
              }}
            />
          </div>
        </div>

        {/* Contacts section */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>
              Contacts ({claims.contacts.length} of 10)
            </span>
            {claims.contacts.length < 10 && (
              <button
                type="button"
                onClick={handleAddContact}
                disabled={isRunningChecks}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-action)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add contact
              </button>
            )}
          </div>
          {claims.contacts.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Unknown</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {claims.contacts.map((contact, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    value={contact.kind}
                    aria-label={`Contact ${idx + 1} type`}
                    onChange={(e) =>
                      handleContactChange(idx, "kind", e.target.value as "email" | "phone" | "other")
                    }
                    disabled={isRunningChecks}
                    style={{
                      minHeight: "44px",
                      padding: "8px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-divider)",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="text"
                    value={contact.value}
                    aria-label={`Contact ${idx + 1} value`}
                    placeholder="Contact detail"
                    onChange={(e) => handleContactChange(idx, "value", e.target.value)}
                    disabled={isRunningChecks}
                    style={{
                      flex: 1,
                      minHeight: "44px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-divider)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(idx)}
                    disabled={isRunningChecks}
                    aria-label={`Remove contact ${idx + 1}`}
                    style={{
                      minHeight: "44px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-divider)",
                      background: "none",
                      color: "var(--color-danger)",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links section */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>
              Links ({claims.links.length} of 10)
            </span>
            {claims.links.length < 10 && (
              <button
                type="button"
                onClick={handleAddLink}
                disabled={isRunningChecks}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-action)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add link
              </button>
            )}
          </div>
          {claims.links.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Unknown</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {claims.links.map((link, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={link}
                    aria-label={`Link ${idx + 1}`}
                    placeholder="https://..."
                    onChange={(e) => handleLinkChange(idx, e.target.value)}
                    disabled={isRunningChecks}
                    style={{
                      flex: 1,
                      minHeight: "44px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-divider)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                    disabled={isRunningChecks}
                    aria-label={`Remove link ${idx + 1}`}
                    style={{
                      minHeight: "44px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-divider)",
                      background: "none",
                      color: "var(--color-danger)",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fee Claims Display */}
        {claims.feeClaims.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
              Extracted fee statements ({claims.feeClaims.length})
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {claims.feeClaims.map((claim, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor:
                      claim.kind === "demand"
                        ? "var(--color-danger-bg)"
                        : claim.kind === "training_offer"
                        ? "var(--color-caution-bg)"
                        : "var(--bg-color)",
                    border: "1px solid var(--border-divider)",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                    Type: {claim.kind.replace("_", " ")}
                  </div>
                  <div style={{ fontStyle: "italic", wordBreak: "break-word" }}>
                    &ldquo;{claim.quote}&rdquo;
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            <AlertCircleIcon size={18} color="var(--color-danger)" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="submit"
            id="btn-run-checks"
            disabled={isRunningChecks}
            style={{
              minHeight: "44px",
              padding: "10px 24px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: isRunningChecks ? "var(--border-divider)" : "var(--color-action)",
              color: isRunningChecks ? "var(--text-secondary)" : "#FFFFFF",
              border: "none",
              fontWeight: 600,
              cursor: isRunningChecks ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isRunningChecks && <SpinnerIcon size={16} color="#FFFFFF" />}
            <span>{isRunningChecks ? "Running checks..." : "Run checks"}</span>
          </button>

          <button
            type="button"
            id="btn-edit-posting"
            onClick={onEditPosting}
            disabled={isRunningChecks}
            style={{
              minHeight: "44px",
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--surface-color)",
              color: "var(--text-main)",
              border: "1px solid var(--border-divider)",
              fontWeight: 500,
              cursor: isRunningChecks ? "not-allowed" : "pointer",
            }}
          >
            Edit posting
          </button>
        </div>
      </form>
    </section>
  );
}
