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
      className="nb-card"
      style={{ marginBottom: "28px" }}
    >
      <div style={{ marginBottom: "18px" }}>
        <h2
          id="review-section-heading"
          ref={headingRef}
          tabIndex={-1}
          style={{ fontSize: "20px", fontWeight: 800, outline: "none", marginBottom: "8px" }}
        >
          Review extracted claims
        </h2>
        <p style={{ fontSize: "14px", color: "#333333", borderLeft: "3px solid #000000", paddingLeft: "10px" }}>
          Confirm or correct extracted details before verification. Note that original message
          text remains immutable for quote-based risk signals.
        </p>
      </div>

      {/* Immutable Source Disclosure */}
      <div
        style={{
          border: "3px solid #000000",
          padding: "12px",
          marginBottom: "22px",
          backgroundColor: "#FFFDF5",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#000000" }}>
            Original source text ({source.inputType === "url" ? "Fetched URL" : "Message text"})
          </span>
          <button
            type="button"
            onClick={() => setShowSourceText(!showSourceText)}
            className="btn-ghost"
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
                  color: "#444444",
                  marginBottom: "6px",
                  wordBreak: "break-all",
                  fontFamily: "var(--font-mono)",
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
                border: "2px solid #000000",
                fontFamily: "var(--font-mono)",
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
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            marginBottom: "22px",
          }}
        >
          {/* Company Name */}
          <div>
            <label
              htmlFor="field-company"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Company name *
            </label>
            <input
              id="field-company"
              type="text"
              className="nb-input"
              value={claims.companyName ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("companyName", e.target.value)}
              disabled={isRunningChecks}
            />
          </div>

          {/* Role */}
          <div>
            <label
              htmlFor="field-role"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Job role *
            </label>
            <input
              id="field-role"
              type="text"
              className="nb-input"
              value={claims.role ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("role", e.target.value)}
              disabled={isRunningChecks}
            />
          </div>

          {/* Employer Domain */}
          <div>
            <label
              htmlFor="field-domain"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Employer domain candidate
            </label>
            <input
              id="field-domain"
              type="text"
              className="nb-input"
              value={claims.employerDomain ?? ""}
              placeholder="Unknown (e.g. acme.com)"
              onChange={(e) => handleFieldChange("employerDomain", e.target.value)}
              disabled={isRunningChecks}
            />
            <span style={{ fontSize: "12px", color: "#555555", display: "block", marginTop: "4px" }}>
              Do not enter a free-email provider or job board.
            </span>
          </div>

          {/* Salary */}
          <div>
            <label
              htmlFor="field-salary"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Salary / Compensation
            </label>
            <input
              id="field-salary"
              type="text"
              className="nb-input"
              value={claims.salary ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("salary", e.target.value)}
              disabled={isRunningChecks}
            />
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="field-location"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Location
            </label>
            <input
              id="field-location"
              type="text"
              className="nb-input"
              value={claims.location ?? ""}
              placeholder="Unknown"
              onChange={(e) => handleFieldChange("location", e.target.value)}
              disabled={isRunningChecks}
            />
          </div>

          {/* Claimed Operating Years */}
          <div>
            <label
              htmlFor="field-years"
              style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "5px" }}
            >
              Claimed operating history (years)
            </label>
            <input
              id="field-years"
              type="number"
              className="nb-input"
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
            />
          </div>
        </div>

        {/* Contacts section */}
        <div style={{ marginBottom: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              Contacts ({claims.contacts.length} of 10)
            </span>
            {claims.contacts.length < 10 && (
              <button
                type="button"
                onClick={handleAddContact}
                disabled={isRunningChecks}
                className="btn-ghost"
              >
                + Add contact
              </button>
            )}
          </div>
          {claims.contacts.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#555555" }}>Unknown</p>
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
                    className="nb-input"
                    style={{ width: "auto", flex: "0 0 auto" }}
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
                    className="nb-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(idx)}
                    disabled={isRunningChecks}
                    aria-label={`Remove contact ${idx + 1}`}
                    className="btn-secondary"
                    style={{ padding: "8px 12px", minHeight: "44px", color: "#CC0000", flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links section */}
        <div style={{ marginBottom: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              Links ({claims.links.length} of 10)
            </span>
            {claims.links.length < 10 && (
              <button
                type="button"
                onClick={handleAddLink}
                disabled={isRunningChecks}
                className="btn-ghost"
              >
                + Add link
              </button>
            )}
          </div>
          {claims.links.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#555555" }}>Unknown</p>
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
                    className="nb-input"
                    style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                    disabled={isRunningChecks}
                    aria-label={`Remove link ${idx + 1}`}
                    className="btn-secondary"
                    style={{ padding: "8px 12px", minHeight: "44px", color: "#CC0000", flexShrink: 0 }}
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
          <div style={{ marginBottom: "22px" }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>
              Extracted fee statements ({claims.feeClaims.length})
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {claims.feeClaims.map((claim, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    backgroundColor:
                      claim.kind === "demand"
                        ? "#FFE5E5"
                        : claim.kind === "training_offer"
                        ? "#FFF3E0"
                        : "#FFFDF5",
                    border: `3px solid ${
                      claim.kind === "demand"
                        ? "var(--color-danger)"
                        : claim.kind === "training_offer"
                        ? "var(--color-caution)"
                        : "#000000"
                    }`,
                    fontSize: "13px",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>
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
              backgroundColor: "#FFE5E5",
              color: "#000000",
              padding: "10px 14px",
              border: "3px solid var(--color-danger)",
              marginBottom: "18px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <AlertCircleIcon size={18} color="var(--color-danger)" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="submit"
            id="btn-run-checks"
            disabled={isRunningChecks}
            className="btn-primary"
          >
            {isRunningChecks && <SpinnerIcon size={16} color="#000000" />}
            <span>{isRunningChecks ? "Running checks..." : "Run checks"}</span>
          </button>

          <button
            type="button"
            id="btn-edit-posting"
            onClick={onEditPosting}
            disabled={isRunningChecks}
            className="btn-secondary"
          >
            Edit posting
          </button>
        </div>
      </form>
    </section>
  );
}
