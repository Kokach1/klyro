# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

### 2026-10-11T02:45:00+05:30 — Fix outbound page fetch blocking with browser User-Agent and strict HTML policy

- Changed: Updated `lib/safe-fetch.ts` to send a standard real browser `User-Agent` (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36`) and modern navigation headers on all outbound requests; enforced max 3 redirects and 8s timeout; restricted content types strictly to HTML (`text/html`, `application/xhtml+xml`); updated `lib/checks/careers-match.ts`, `lib/checks/registration.ts`, and `lib/checks/complaints.ts` to align with 8s timeout and 3 redirects; added tests in `tests/safe-fetch.test.ts`.
- Why: Prevent anti-bot scrapers and Cloudflare from immediately blocking outbound vacancy, career page, and registry checks due to generic/bot user agent strings, while properly preserving `blocked_page` handling for targets that still refuse access (HTTP 401/403/429).
- Validation: 37 Vitest tests passing (`npm test`), TypeScript typecheck passing, and production build compiled successfully.
- Limitations: Sites with heavy JavaScript challenge walls that refuse all HTTP requests still resolve to `blocked_page` / inconclusive as designed.

### 2026-10-11T01:59:37+05:30 — Preserve scan state while opening verification results

- Changed: Updated `app/page.tsx` to use the History API for internal `#review` and `#results` address updates instead of dispatching hash-change navigation events.
- Why: Opening `#results` while the verification stream was still pending triggered the direct-link safeguard and reset the scan to the input page.
- Validation: `npm run typecheck` passed; automated tests and production build are recorded with this change after the sandbox filesystem validation restriction is cleared.
- Limitations: Direct result anchors without an active scan still return to the input state by design.

### 2026-10-11T01:45:00+05:30 — Add live extraction progress bar and verification streaming monitor

- Changed: Added live animated progress bar and detailed status card to `components/InputForm.tsx` during extraction; added striped animated progress keyframes in `app/globals.css`; added real-time 5-check progression monitor with live completion counter and checklist badges in `app/page.tsx`.
- Why: Give users clear, animated visual feedback with real-time progression bars during both extraction and verification checks instead of an unresponsive-looking screen.
- Validation: 35 automated Vitest tests passed, `npm run build` compiled without errors.
- Limitations: None; visual progression enhancement only.

### 2026-10-11T01:36:00+05:30 — Add Gemini model fallback chain and defensive credential parsing

- Changed: Updated `lib/providers/gemini.ts` with a multi-model fallback chain (`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`), updated `lib/env.ts` to defensively parse WhoisXML API keys when sample URLs are pasted, and updated `app/api/extract/route.ts` to surface detailed error causes.
- Why: Google's `gemini-3.8-flash` preview endpoint occasionally returns HTTP 503 high demand spikes. Adding an automated fallback to stable `gemini-3.5-flash` ensures structured extraction succeeds continuously without failing user requests.
- Validation: Verified live call to Google Gemini endpoint returning HTTP 200 with structured claims. All 35 Vitest tests and production build passed.
- Limitations: None; server-side only.

### 2026-10-11T01:11:16+05:30 — Remove recorded demo flow and separate methodology page

- Changed: Removed fixture loading, fixture data, the fixture response mode, and fixture-only result UI from `app/page.tsx`, `fixtures/demo-cases.ts`, `components/ResultsSection.tsx`, and `lib/contracts.ts`; added `app/about/page.tsx`; updated the home-page navigation and project documentation.
- Why: Keep the product limited to live checks and move About & Methodology out of the scan workflow.
- Validation: `npm run test` passed (35 tests), `npm run typecheck` passed, and `npm run build` passed with both `/` and `/about` generated.
- Limitations: Live Gemini extraction and SerpAPI checks responded successfully in an end-to-end local scan. The configured WhoisXML credential was rejected by its provider, so domain-age checks remain honestly unavailable until it is replaced.

### 2026-10-11T00:50:00+05:30 — Restyle UI with neo-brutalism design system

- Changed: Updated `app/globals.css`, `app/page.tsx`, `components/CheckCard.tsx`, `components/ClaimReview.tsx`, `components/InputForm.tsx`, `components/MethodologySection.tsx`, `components/ResultsSection.tsx`, and `components/RiskDial.tsx`.
- Why: Implement neo-brutalism visual theme with cream page background (`#FFFDF5`), white cards, 3px solid black borders, hard offset shadows (`6px 6px 0 #000`, `4px 4px 0 #000`), 0 border-radius sharp edges, bold headings, primary action yellow (`#FFDC58`), safe green (`#7FBC8C`), caution orange (`#FFB347`), warning red (`#FF6B6B`), monospace risk score numbers and evidence URLs, button hover/press translations, input focus shadows, and bordered status chips.
- Validation: 35 automated Vitest tests passed, `npm run build` compiled without errors, and local Next.js production server verified.
- Limitations: None; visual presentation only without altering extraction, checks, scoring, or page logic.

### 2026-10-10T23:35:00+05:30 — Implement Gemini-then-OpenAI fallback provider chain for extraction

- Changed: Added `lib/providers/gemini.ts` and `lib/providers/extraction-chain.ts`; updated `app/api/extract/route.ts`, `lib/env.ts`, `.env.example`, and added `tests/extraction-chain.test.ts`.
- Why: Support sequential rotation across multiple Gemini API keys (`GEMINI_API_KEYS`), automatically falling back to OpenAI (`OPENAI_API_KEY`) when Gemini quota is exhausted, and returning honest 503 unavailable status if all providers fail.
- Validation: 35 automated Vitest tests passed including key rotation, fallback, and honest exhaustion error without credential leakage.
- Limitations: Server-side only; once a provider succeeds for a scan, that scan finishes on it.

### 2026-10-10T22:30:00+05:30 — Failure testing, secret scanning, and visual responsive verification

- Changed: Added `tests/failure-and-edge-cases.test.ts`, ran bundle secret scanner and zero-emoji verification, verified viewports at 320px, 390px, and desktop.
- Why: Ensure the detector resists prompt injection, handles missing dates and provider timeouts, and presents responsive mobile UI without horizontal overflow.
- Validation: 30 automated Vitest tests passed, `npm run build` compiled, and browser subagent verified visual layouts.
- Limitations: Live external provider calls unverified without user's private keys; pre-recorded demo fixtures and fallback modes operate fully.

### 2026-10-10T22:25:00+05:30 — Results UI, risk dial, check cards, and demo fixtures

- Changed: Added `components/RiskDial.tsx`, `components/CheckCard.tsx`, `components/ResultsSection.tsx`, `components/MethodologySection.tsx`, and `fixtures/demo-cases.ts`.
- Why: Provide evidence-grounded result presentation with semicircular risk dial (0-100, no percent sign), coverage counts, expandable evidence items, and 4 test fixtures.
- Validation: Rendered and verified all four fixtures (Safe, Likely Scam, Caution, Unavailable).
- Limitations: None identified in these checks.

### 2026-10-10T22:20:00+05:30 — Verification API orchestration and NDJSON streaming

- Changed: Added `app/api/verify/route.ts` with concurrent check execution, NDJSON streaming (`Accept: application/x-ndjson`), 15s per-check budget, partial results, and rule fallback summaries.
- Why: Deliver real-time check progress and resilient degradation on missing external keys without failing the request.
- Validation: Route handler typechecked and verified with simulated stream events.
- Limitations: In-memory rate limiting applies per-instance.

### 2026-10-10T22:15:00+05:30 — SerpAPI search checks and deterministic rule engine

- Changed: Added `lib/checks/careers-match.ts`, `lib/checks/registration.ts`, `lib/checks/complaints.ts`, `lib/providers/serpapi.ts`, and `tests/rules.test.ts`.
- Why: Verify official careers vacancies, Indian MCA Corporate Identification Numbers (CIN), and multi-source complaint patterns.
- Validation: 25 Vitest tests passed across scoring rubric, harmful override, and safe gate.
- Limitations: Search checks capped at 2 pages read per check to conserve bandwidth.

### 2026-10-10T22:10:00+05:30 — Message flags, WhoisXML domain age, and date math

- Changed: Added `lib/checks/message-flags.ts`, `lib/checks/domain-age.ts`, `lib/providers/whoisxml.ts`, and `tests/checks-message-domain.test.ts`.
- Why: Detect candidate fee demands (negation-aware), free webmail recruiters, and domain age contradictions using calendar-month date math with leap-year clamping.
- Validation: 17 Vitest tests passed covering leap-year Feb 29 date math and negation patterns.
- Limitations: None identified in these checks.

### 2026-10-10T22:05:00+05:30 — Input form and claim review components

- Changed: Added `components/InputForm.tsx`, `components/ClaimReview.tsx`, and `components/Icons.tsx`.
- Why: Let users submit postings via text or URL, view live character counters, and review/edit extracted claims before running verification.
- Validation: Tested form inputs, character limits (20,000 chars text / 2,048 chars URL), and focus management.
- Limitations: None identified in these checks.

### 2026-10-10T22:00:00+05:30 — SSRF defense, safe URL fetching, and structured extraction

- Changed: Added `lib/safe-fetch.ts`, `lib/providers/openai.ts`, and `app/api/extract/route.ts`.
- Why: Provide SSRF defense against private/loopback/cloud metadata IP ranges, pin validated IP addresses, and extract claims using OpenAI JSON schemas with fee quote validation.
- Validation: 10 Vitest tests passed (`tests/safe-fetch.test.ts`, `tests/extraction-quotes.test.ts`).
- Limitations: URL fetching limited to public HTTP(S) text/HTML up to 1 MiB.

### 2026-10-10T21:55:00+05:30 — Project scaffolding and contracts

- Changed: Initialized Next.js 15, TypeScript, Zod, Vitest; created `lib/contracts.ts`, `lib/env.ts`, `lib/rules.ts`, `app/globals.css`, `app/layout.tsx`, and docs in `/docs`.
- Why: Scaffold deployable shell and establish runtime data schemas and design tokens.
- Validation: `npm run typecheck` and `npm run build` completed successfully.
- Limitations: Initial skeleton before check logic implementation.

## Template setup — 10 October 2026

- Changed: Added the event README, rules, agent guide, change log, AI usage record, submission checklist, Git ignore rules, and pull request checklist.
- Why: Give participants a consistent starting point for event rules, basic coding patterns, documented changes, and regular commits.
- Validation: Checked local Markdown links, event detail consistency, required documents, and diff whitespace before publishing.
- Limitations: Documentation scaffolding only; no participant project, application, or working demo is included. GitHub publication and template status are verified separately after creation.
