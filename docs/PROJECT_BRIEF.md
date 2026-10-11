# Job Scam Detector: Project Brief

## Scope and Purpose
Klyro is a single-page web application designed to help job seekers evaluate job postings, messages, and offer letters for risk signals before applying or paying. It identifies common scam patterns, validates employer domains, cross-checks official careers portals, and searches for reported complaints.

The application operates as a deterministic, evidence-backed evaluation pipeline. It reports risk signals and allegations found, not legal findings or guaranteed legitimacy.

## Core Verdict Labels and Definitions
- **Safe**: "No major risk signals found in completed checks. Not a guarantee."
- **Caution**: "Some concerns or checks remain unresolved."
- **Likely Scam**: "Strong scam-pattern indicators in this posting."

## Fixed Disclaimer
"This tool reports risk signals and allegations found, not legal findings or guaranteed legitimacy."

## Scope
- Scan flow at `/` with `#review` and `#results` anchors; About and Methodology at `/about`.
- In-memory state only: refreshing resets the scan. No result IDs, database, history, accounts, or persistent storage.
- Input modes:
  - Message text (default): multiline textarea (up to 20,000 characters).
  - Job link: URL input (up to 2,048 characters) with strict safe-fetching policy.
- Extraction & Review:
  - Structured claim extraction via OpenAI API.
  - User review and manual correction of extracted claims. Source text remains immutable.
- Verification & Checks:
- Four bounded checks run concurrently:
    1. Message red flags (`message_flags`)
    2. Company domain and age (`domain_age`)
    3. Official careers-page match (`careers_match`)
    4. Complaints and reviews (`complaints`)
  - Terminal statuses: `completed`, `inconclusive`, `unavailable`, `not_applicable`.
  - NDJSON streaming of per-check progress.
- Verdict & Scoring:
  - Deterministic 0-100 risk index (no percent sign; higher = more observed risk signals, not a probability).
  - Coverage summary (for example, "X of 4 checks completed").
  - Summary and next steps grounded strictly in check evidence.

## Out of Scope
- User authentication and accounts
- Database storage and saved history
- Native mobile application
- Auto-apply or browser automation
- Direct recruiter messaging or contact
- Public blacklist or crowd-sourced reporting
- Community reports and user upvoting
- Screenshot upload and OCR (omitted)

## Key Success Criteria
- Honest uncertainty: Never certify an employer as safe or guarantee legitimacy.
- Resilient degradation: Missing API keys or failed external checks produce clean partial results (HTTP 200 with unavailable checks) and default to Caution, unless the harmful payment override applies.
- Zero credential exposure: No secrets in client bundles, logs, or UI.
- Strict privacy: No user postings or contact data stored in query params, localStorage, or server logs.
