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
      style={{
        backgroundColor: "var(--surface-color)",
        border: "1px solid var(--border-divider)",
        borderRadius: "var(--radius-card)",
        padding: "24px 20px",
        marginBottom: "24px",
      }}
    >
      <h2
        id="input-section-heading"
        style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}
      >
        Submit job posting
      </h2>

      {/* Input Mode Selector */}
      <div
        role="tablist"
        aria-label="Input mode"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-message-text"
          aria-selected={inputType === "text"}
          aria-controls="panel-message-text"
          onClick={() => handleModeChange("text")}
          disabled={isLoading}
          style={{
            minHeight: "44px",
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid",
            borderColor: inputType === "text" ? "var(--color-action)" : "var(--border-divider)",
            backgroundColor: inputType === "text" ? "var(--color-safe-bg)" : "var(--surface-color)",
            color: inputType === "text" ? "var(--color-action)" : "var(--text-secondary)",
            fontWeight: inputType === "text" ? 600 : 400,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          Message text
        </button>
        <button
          type="button"
          role="tab"
          id="tab-job-link"
          aria-selected={inputType === "url"}
          aria-controls="panel-job-link"
          onClick={() => handleModeChange("url")}
          disabled={isLoading}
          style={{
            minHeight: "44px",
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid",
            borderColor: inputType === "url" ? "var(--color-action)" : "var(--border-divider)",
            backgroundColor: inputType === "url" ? "var(--color-safe-bg)" : "var(--surface-color)",
            color: inputType === "url" ? "var(--color-action)" : "var(--text-secondary)",
            fontWeight: inputType === "url" ? 600 : 400,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          Job link
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          {inputType === "text" ? (
            <div id="panel-message-text" role="tabpanel" aria-labelledby="tab-message-text">
              <label
                htmlFor="message-text-input"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                Forwarded message or email body
              </label>
              <textarea
                id="message-text-input"
                rows={8}
                value={inputValue}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Paste the full forwarded job message"
                aria-describedby={displayError ? "input-error-desc" : undefined}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid",
                  borderColor: displayError ? "var(--color-danger)" : "var(--border-divider)",
                  backgroundColor: "#FFFFFF",
                  color: "var(--text-main)",
                  fontSize: "15px",
                  lineHeight: "1.5",
                  resize: "vertical",
                }}
              />
            </div>
          ) : (
            <div id="panel-job-link" role="tabpanel" aria-labelledby="tab-job-link">
              <label
                htmlFor="job-link-input"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                Public job posting URL
              </label>
              <input
                id="job-link-input"
                type="url"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Paste a public job posting URL"
                aria-describedby={displayError ? "input-error-desc" : undefined}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid",
                  borderColor: displayError ? "var(--color-danger)" : "var(--border-divider)",
                  backgroundColor: "#FFFFFF",
                  color: "var(--text-main)",
                  fontSize: "15px",
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
              color: isOverLimit
                ? "var(--color-danger)"
                : isNearLimit
                ? "var(--color-caution)"
                : "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            <span>
              {currentLength.toLocaleString()} / {currentLimit.toLocaleString()} characters
            </span>
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
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              marginBottom: "16px",
              fontSize: "14px",
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
            color: "var(--text-secondary)",
            lineHeight: "1.4",
            marginBottom: "16px",
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
          disabled={isLoading || inputValue.trim().length === 0 || isOverLimit}
          style={{
            minHeight: "44px",
            padding: "10px 24px",
            borderRadius: "var(--radius-sm)",
            backgroundColor:
              isLoading || inputValue.trim().length === 0 || isOverLimit
                ? "var(--border-divider)"
                : "var(--color-action)",
            color:
              isLoading || inputValue.trim().length === 0 || isOverLimit
                ? "var(--text-secondary)"
                : "#FFFFFF",
            border: "none",
            fontWeight: 600,
            cursor:
              isLoading || inputValue.trim().length === 0 || isOverLimit
                ? "not-allowed"
                : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isLoading && <SpinnerIcon size={16} color="#FFFFFF" />}
          <span>{isLoading ? "Reading the posting..." : "Analyse"}</span>
        </button>
      </form>
    </section>
  );
}
