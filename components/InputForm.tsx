"use client";

import React, { useState } from "react";
import { SpinnerIcon, AlertCircleIcon } from "./Icons";

interface InputFormProps {
  onAnalyze: (inputType: "text" | "url", input: string) => Promise<void>;
  isLoading: boolean;
  initialInputType?: "text" | "url";
  initialInput?: string;
  serverError?: string | null;
  onClearError?: () => void;
}

export function InputForm({
  onAnalyze,
  isLoading,
  initialInputType = "text",
  initialInput = "",
  serverError = null,
  onClearError,
}: InputFormProps) {
  const [inputType, setInputType] = useState<"text" | "url">(initialInputType);
  const [inputValue, setInputValue] = useState<string>(initialInput);
  const [clientError, setClientError] = useState<string | null>(null);

  const textLimit = 20000;
  const urlLimit = 2048;
  const currentLimit = inputType === "text" ? textLimit : urlLimit;
  const currentLength = inputValue.length;
  const isNearLimit = currentLength > currentLimit * 0.9;
  const isOverLimit = currentLength > currentLimit;

  const displayError = clientError || serverError;

  const handleModeChange = (type: "text" | "url") => {
    if (isLoading) return;
    setInputType(type);
    setClientError(null);
    if (onClearError) onClearError();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setInputValue(e.target.value);
    setClientError(null);
    if (onClearError) onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setClientError(
        inputType === "text"
          ? "Please paste the job message text to analyze."
          : "Please enter a valid job URL."
      );
      return;
    }

    if (inputType === "url") {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setClientError("Only HTTP and HTTPS URLs are supported.");
          return;
        }
      } catch {
        setClientError("Please enter a valid absolute public URL (starting with http:// or https://).");
        return;
      }
    }

    if (trimmed.length > currentLimit) {
      setClientError(
        `Input exceeds the maximum allowed length of ${currentLimit.toLocaleString()} characters.`
      );
      return;
    }

    await onAnalyze(inputType, trimmed);
  };

  return (
    <section
      aria-labelledby="input-section-heading"
      className="nb-card"
      style={{ marginBottom: "28px" }}
    >
      <h2
        id="input-section-heading"
        style={{ fontSize: "20px", fontWeight: 800, marginBottom: "18px", letterSpacing: "-0.3px" }}
      >
        Submit job posting
      </h2>

      {/* Input Mode Selector */}
      <div
        role="tablist"
        aria-label="Input mode"
        style={{ display: "flex", gap: "10px", marginBottom: "18px" }}
      >
        {(["text", "url"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            id={type === "text" ? "tab-message-text" : "tab-job-link"}
            aria-selected={inputType === type}
            aria-controls={type === "text" ? "panel-message-text" : "panel-job-link"}
            onClick={() => handleModeChange(type)}
            disabled={isLoading}
            style={{
              minHeight: "40px",
              padding: "6px 18px",
              border: "3px solid #000000",
              backgroundColor: inputType === type ? "#FFDC58" : "#FFFFFF",
              color: "#000000",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: inputType === type ? "3px 3px 0 #000000" : "none",
              transition: "box-shadow 0.08s ease",
            }}
          >
            {type === "text" ? "Message text" : "Job link"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "14px" }}>
          {inputType === "text" ? (
            <div id="panel-message-text" role="tabpanel" aria-labelledby="tab-message-text">
              <label
                htmlFor="message-text-input"
                style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}
              >
                Forwarded message or email body
              </label>
              <textarea
                id="message-text-input"
                className="nb-input"
                rows={8}
                value={inputValue}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Paste the full forwarded job message"
                aria-describedby={displayError ? "input-error-desc" : undefined}
                style={{
                  resize: "vertical",
                  border: displayError ? "3px solid var(--color-danger)" : undefined,
                }}
              />
            </div>
          ) : (
            <div id="panel-job-link" role="tabpanel" aria-labelledby="tab-job-link">
              <label
                htmlFor="job-link-input"
                style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}
              >
                Public job posting URL
              </label>
              <input
                id="job-link-input"
                type="url"
                className="nb-input"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Paste a public job posting URL"
                aria-describedby={displayError ? "input-error-desc" : undefined}
                style={{
                  border: displayError ? "3px solid var(--color-danger)" : undefined,
                }}
              />
            </div>
          )}

          {/* Character counter */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: isOverLimit ? "var(--color-danger)" : isNearLimit ? "#B85C00" : "#555555",
              marginTop: "5px",
            }}
          >
            {currentLength.toLocaleString()} / {currentLimit.toLocaleString()} chars
          </div>
        </div>

        {/* Error message */}
        {displayError && (
          <div
            id="input-error-desc"
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#FFE5E5",
              color: "#000000",
              padding: "10px 14px",
              border: "3px solid var(--color-danger)",
              marginBottom: "16px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <AlertCircleIcon size={18} color="var(--color-danger)" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Verbatim Privacy Notice */}
        <p
          style={{
            fontSize: "13px",
            color: "#444444",
            lineHeight: "1.5",
            marginBottom: "18px",
            borderLeft: "3px solid #000000",
            paddingLeft: "10px",
          }}
        >
          Your posting is sent to AI services. Company/domain search terms are sent to search
          providers. This app does not save your posting or contact details. Remove sensitive
          information before submitting.
        </p>

        {/* Action Button */}
        <button
          type="submit"
          id="btn-analyse"
          className="btn-primary"
          disabled={isLoading || inputValue.trim().length === 0 || isOverLimit}
        >
          {isLoading && <SpinnerIcon size={16} color="#000000" />}
          <span>{isLoading ? "Analyzing posting..." : "Analyse posting"}</span>
        </button>

        {/* Live Extraction Progression Bar */}
        {isLoading && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px 18px",
              backgroundColor: "#FFFFFF",
              border: "3px solid #000000",
              boxShadow: "4px 4px 0 #000000",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#000000",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <SpinnerIcon size={16} color="#000000" />
                Scanning posting with Google Gemini AI...
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  padding: "3px 8px",
                  backgroundColor: "var(--color-action)",
                  border: "2px solid #000000",
                }}
              >
                In progress
              </span>
            </div>

            {/* Striped animated progression bar */}
            <div
              style={{
                width: "100%",
                height: "18px",
                backgroundColor: "#E0E0E0",
                border: "2px solid #000000",
                overflow: "hidden",
              }}
            >
              <div
                className="nb-progress-striped"
                style={{
                  height: "100%",
                  width: "100%",
                  backgroundColor: "var(--color-action)",
                }}
              />
            </div>

            <p style={{ fontSize: "12px", color: "#444444", marginTop: "10px", lineHeight: "1.4" }}>
              Extracting company identity, role title, compensation, recruiter contact channels, and candidate fee claims.
            </p>
          </div>
        )}
      </form>
    </section>
  );
}
