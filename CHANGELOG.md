# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

### 2026-10-11T09:11:20+05:30 — Publish professional repository documentation

- Changed:
  - `README.md`: Added the production demo link, clarified the product description and live-scan behavior, corrected the current four-check project structure, and documented deployment access expectations.
  - `SUBMISSION.md`: Added labeled project, production demo, repository, workflow, validation, and limitations details; corrected the submitted commit SHA to `cfb4bb3`.
  - `docs/PROJECT_BRIEF.md`, `docs/SITEMAP.md`, `docs/UI_UX_SPEC.md`, `docs/TECHNICAL_SPEC.md`, and `docs/AGENTS.md`: Aligned the documentation with the implemented four-check system and removed obsolete registration-check requirements.
- Why: Make the repository suitable for professional review and ensure public documentation matches the deployed application.
- Validation: Checked Markdown consistency, confirmed no stale five-check references in current documentation, and scanned documentation for emoji-range characters.
- Limitations: The deployed demo still depends on the server-side provider credentials described in `.env.example`.

### 2026-10-11T08:23:00+05:30 — Make live risk and coverage progress dynamic

- Changed:
  - `app/page.tsx`: Stores each streamed check result in React state and recalculates the in-progress risk index, label, and coverage strictly from returned completed checks. The verification screen now displays a live risk dial and dynamic completed-check count; the progress bar follows returned check results. Retries clear the previous verdict before showing fresh live progress.
  - `components/ResultsSection.tsx`: Replaced the stale hard-coded coverage denominator with `coverage.total`.
  - `README.md`: Documented that the provisional risk index and coverage update during verification.
- Why: The completed-check display previously looked static and the in-progress view did not expose the same live rule inputs used for the final score.
- Validation: `npm run typecheck` passed; `npm test` passed (55 tests across 8 files); `npm run build` completed successfully.
- Limitations: The in-progress reading is provisional; it becomes the final displayed result only after the verification stream finishes.

### 2026-10-11T06:33:00+05:30 — Remove Indian company registration checker and update to 4-check system

- Changed:
  - `lib/checks/registration.ts`: Removed the Indian corporate registration checker and MCA/CIN search module.
  - `lib/contracts.ts`: Updated `CheckIdSchema` and `CHECK_IDS_ORDERED` from 5 checks to 4 checks (`message_flags`, `domain_age`, `careers_match`, `complaints`); updated `CoverageSchema` and `VerdictResponseSchema` checks length and total literal from 5 to 4.
  - `lib/rules.ts`: Updated `calculateCoverage` total to 4; updated safe gate summary description to 4 checks; retained honest partial coverage scoring and locked Safe label semantics.
  - `app/api/verify/route.ts`: Removed `checkRegistration` execution from both the real-time NDJSON streaming pipeline and the fallback JSON pipeline.
  - `app/page.tsx`: Removed `registration` from UI check states; updated progress message to 4 checks; adjusted progression counter and progress bar to reflect 4 checks; removed the corporate registration card from the in-progress monitor.
  - `components/CheckCard.tsx`: Removed registration entry from `CHECK_TITLES`.
  - `components/MethodologySection.tsx`: Updated documentation from five checks to four checks, removing the MCA records/CIN registration check description.
  - `tests/rules.test.ts`, `tests/failure-and-edge-cases.test.ts`, `tests/smarter-search.test.ts`: Updated test suites to reflect 4 checks, removed registration unit tests, verified partial scoring and safe gate with 4 checks.
  - `README.md` & `SUBMISSION.md`: Updated verification pipeline documentation and demo steps to 4 checks.
- Why: User requested removing the Indian company registration checker and its output, transitioning the tool to a streamlined 4-check evidence verification system.
- Validation: All 55 Vitest automated tests passing across 8 test suites (`npm test`); Next.js production build (`npm run build`) succeeded with 0 errors.
- Limitations: Verification now focuses on message flags, domain age & WHOIS, official careers matching, and public complaint patterns; Indian registry lookups are no longer performed.


### 2026-10-11T05:55:00+05:30 — Fix Job Link extraction, DNS lookup pin, and array limit clamping

- Changed:
  - `lib/safe-fetch.ts`: Fixed `lookup` callback signature in `https.request` DNS pinning to properly check `options.all` and pass `[{ address, family }]` when requested by Node.js, resolving `Invalid IP address: undefined` failures on all outbound HTTP/HTTPS fetches.
  - `lib/providers/jina.ts`: Removed fake browser `User-Agent` header when calling `https://r.jina.ai/<url>` so Cloudflare no longer triggers HTTP 403 bot challenges on Jina Reader page fetches.
  - `app/api/extract/route.ts`: Updated job URL analysis to auto-prepend `https://` if omitted, route initial page reads through `fetchWithJinaReader` (to render SPAs and bypass scrape walls) with fallback to `safeFetchUrl`, and increased extraction timeout budget to 25s.
  - `components/InputForm.tsx`: Automatically prepends `https://` to submitted job URLs and validates URL format gracefully without rejecting un-prefixed domains.
  - `lib/providers/gemini.ts` & `lib/providers/openai.ts`: Clamped extracted `links` and `contacts` arrays to at most 10 elements prior to Zod validation, preventing `too_big` validation crashes on job board directory pages containing dozens of vacancy links.
  - `lib/checks/registration.ts`: Skipped redundant candidate page fetches when search snippet already corroborated exact legal name and CIN.
- Why: Fix the job link submission option so users can paste any public job vacancy URL (including SPAs and pages with multiple links) and successfully extract claims for review.
- Validation: Verified live in browser with `browser_subagent` submitting `https://infopark.in/jobs` -> successfully transitioned to `#review` stage with extracted claims; all 62 Vitest unit tests passed (`npm test`); Next.js production build (`npm run build`) succeeded with 0 errors.
- Limitations: URLs that require user authentication, intranet credentials, or CAPTCHA cannot be read and prompt the user to paste message text instead.


### 2026-10-11T04:38:00+05:30 — Fix Gemini key rotation and partial scoring with mandatory coverage and locked Safe label

- Changed:
  - `lib/env.ts`: Combined comma-separated keys from both `GEMINI_API_KEYS` and `GEMINI_API_KEY` into a deduplicated key array; set default `GEMINI_MODEL` to `gemini-3.8-flash`.
  - `lib/providers/gemini.ts`: Set primary model to `gemini-3.8-flash` (with fallbacks `gemini-2.5-flash`, `gemini-flash-latest`) to avoid 404s on retired models; structured clean quota/auth/network error throwing.
  - `lib/providers/extraction-chain.ts`: Added explicit `continue;` in the Gemini key loop to ensure any failure on key #1 (429, invalid key, network) proceeds to key #2, #3, etc., without aborting, and recorded warnings when rotated keys succeed.
  - `lib/rules.ts`:
    - Enforced that Safe label stays locked unless ALL applicable checks complete cleanly (`coverage.completed === coverage.total && !anyInconclusive && !anyUnavailable`).
    - With partial coverage, verdict defaults to Caution with explicit explanation: `"Caution (based on X of 5 checks): Safe label is locked until all checks complete."`
    - Missing/unavailable checks contribute 0 points and stay neutral (never reduce or artificially increase score).
    - Rule summaries reflect partial coverage explicitly.
  - `app/api/verify/route.ts` & `app/page.tsx`: Filtered checks to `c.status === "completed"` before gathering signals and computing risk index so partial checks score strictly over completed evidence.
  - `components/RiskDial.tsx` & `components/ResultsSection.tsx`: Added `coverage` prop to `RiskDial` displaying `"{completed} of 5 checks completed"` prominently right under the Risk Index; added `based on X of 5 checks` badge beside the verdict header on partial coverage.
  - `tests/extraction-chain.test.ts`: Added unit test verifying `GEMINI_API_KEYS="deadkey,realkey"` rotates past `deadkey` and succeeds via `realkey`.
  - `tests/rules.test.ts`: Added unit tests verifying partial scoring over completed checks only (3 of 5 completed), neutral contribution of missing checks, locked Safe label under partial coverage, and unlocked Safe label on 5 of 5 clean completion.
- Why: Fix premature loop termination during Gemini key rotation (preventing failures when dead or rate-limited keys precede active keys) and ensure honest partial scoring that never misleads users with an unqualified Safe label or missing coverage context.
- Validation: Verified live rotation over real network from `deadkey` to working key (`AQ...`); all 62 Vitest tests passed (`npm test`); Next.js production build (`npm run build`) succeeded with 0 errors.
- Limitations: If all configured Gemini keys and OpenAI fallbacks are exhausted, returns honest 503 service unavailable with zero fabricated scores.


### 2026-10-11T04:12:00+05:30 — Route page reads through Jina Reader with employer vs aggregator tiers

- Changed:
  - `lib/providers/jina.ts`: Implemented `fetchWithJinaReader` routing outbound URL reads through `https://r.jina.ai/<targetUrl>` with 8s timeout, untrusted-content sanitization (`sanitizeHtmlToText`), and text clamping; added `JINA_API_KEY` bearer token support (free tier operates without key; key in `.env.local` raises rate limit).
  - `lib/env.ts` & `.env.example`: Added optional `JINA_API_KEY` configuration.
  - `lib/checks/candidate-pages.ts`: Updated `fetchCandidatePages` to fetch candidate pages via `fetchWithJinaReader` instead of direct server fetches.
  - `lib/checks/careers-match.ts`: Maintained 3-tier outcomes: a successful Jina read of the employer's OWN page counts as `verified`, while an aggregator read (or snippet fallback) counts as `corroborated`.
  - `lib/checks/registration.ts` & `lib/checks/complaints.ts`: Updated evidence provider attribution to `jina_reader`.
  - `tests/jina-reader.test.ts`: Added 6 unit tests covering Jina URL routing, Authorization header with key, free tier without key, untrusted-content clamping, rate limiting (429) handling, and employer own page vs aggregator verification tiers.
- Why: Allow outbound page inspection to bypass anti-scraping walls and JavaScript rendering restrictions reliably while preserving honest evidence tiering between employer-owned domains and third-party aggregators.
- Validation: All 59 Vitest unit tests passed (`npm test`); Next.js production build (`npm run build`) succeeded with 0 errors.
- Limitations: If Jina free tier hits rate limits without an API key, candidate reads gracefully fall back to search snippet corroboration.

### 2026-10-11T03:51:00+05:30 — Three-tier evidence outcomes and search-based corroboration fallback

- Changed:
  - `lib/contracts.ts`: Added `CheckTierSchema = z.enum(["verified", "corroborated", "inconclusive"])` and added `tier` to `CheckResultSchema`.
  - `lib/checks/registration.ts`: Implemented 3 check outcomes: `verified` (official registry page directly read), `corroborated` (exact legal name + CIN or incorporation details in search snippet when page fetch fails/blocked), and `inconclusive`. Assigned exact finding wording `"Entity found in Indian registry (search-based)"` for corroborated results.
  - `lib/checks/careers-match.ts`: Implemented 3 check outcomes: `verified` (official careers portal page directly read), `corroborated` (snippet from employer domain or `infopark.in/jobs` naming company + role when page fetch fails/blocked), and `inconclusive`. Assigned exact finding wording `"Listing found via search (page not directly read)"` for corroborated results.
  - `lib/checks/message-flags.ts`, `lib/checks/domain-age.ts`, `lib/checks/complaints.ts`: Explicitly assigned `verified` or `inconclusive` tiers based on outcome.
  - `components/CheckCard.tsx`: Displayed honest tier difference in the UI: `corroborated` renders an amber middle card (`borderLeft: 8px solid var(--color-caution)`, `boxShadow: 6px 6px 0 var(--color-caution)`, warm background `#FFFDF2`) with an amber `Corroborated (search-based)` badge and `"Search-based evidence • Target page was not directly read"` banner, never displaying the green `badge-safe` verified style.
  - `tests/smarter-search.test.ts`: Added 5 unit tests validating the 3 evidence tiers (`verified`, `corroborated`, `inconclusive`), exact wording strings, and fallback behavior when page fetches are blocked.
- Why: Provide honest, transparent verification tiers so users clearly distinguish between official pages directly retrieved by the scanner and search-snippet corroboration from restricted or blocking domains.
- Validation: All 53 Vitest unit tests passed (`npm test`); Next.js production build (`npm run build`) succeeded with 0 errors.
- Limitations: When external sites block both direct server fetches and do not return indexable snippets, checks remain inconclusive.

### 2026-10-11T03:14:06+05:30 — Quote company searches and fetch candidate pages concurrently

- Changed: Added shared search-query and candidate-page helpers; updated careers, registration, and complaints checks to build their SerpAPI query from the extracted company name in double quotes, allow 7 seconds for SerpAPI, select at most three non-blocked candidates, and fetch those pages concurrently with an 8-second limit. Explicitly kept `infopark.in/jobs` eligible for fetching.
- Why: Improve result relevance, avoid serial request timeouts, and return an honest inconclusive result when search leads do not provide a fetchable candidate.
- Validation: `npm run typecheck` passed, `npm run test` passed (48 tests), and `npm run build` passed.
- Limitations: Server-blocked or JavaScript-only sources remain inconclusive; search snippets alone do not establish a complaint pattern.

### 2026-10-11T03:00:00+05:30 — Smarter careers search, ATS prioritization, and snippet-corroborated registry check

- Changed:
  - `lib/checks/careers-match.ts`: Replaced role-keyword soup queries with employer-focused queries (`<company> careers site:<domain>` when domain is present, or `<company> jobs official site`); added priority ranking for candidate pages (1: employer domain, 2: employer-linked ATS portals including `lever.co`, `greenhouse.io`, `workday`, `keka`, 3: general web, 4: aggregators last); filtered out domains on the skip list (`isAlwaysBlockedDomain`) from outbound page fetches so bounded fetch quota is preserved for employer sources.
  - `lib/checks/registration.ts`: Prioritized official/trusted corporate databases (`mca.gov.in`, `zaubacorp.com`, `thecompanycheck.com`, `vakilsearch.com`, `tofler.in`); skipped direct server fetching for `mca.gov.in` and skip-list aggregators; treated snippet CIN + exact legal name matches directly as corporate corroboration (`identityMatch: "high"`, `status: "completed"`, `classification: "corroboration"`) since MCA blocks direct server fetch.
  - `lib/safe-fetch.ts`: Refined `ALWAYS_BLOCKED_SCRAPE_DOMAINS` and `isAlwaysBlockedDomain` covering `linkedin.com`, `glassdoor`, `indeed`, `shine.com`, `naukri.com`, `foundit`, and `ambitionbox`.
  - `tests/smarter-search.test.ts`: Added 9 unit tests covering skip-list domain checks, ATS candidate prioritization, registry source priority, legal name matching with corporate suffix stripping, and snippet CIN corroboration.
- Why: Prevent wasting bounded 2-page fetch quotas on anti-scraping walls (aggregators and MCA); ensure candidate reading focuses on employer's own portal or verified ATS platforms; allow genuine Indian company registrations to be corroborated directly via Google search snippets carrying CIN and registered legal entity name.
- Validation: All 46 Vitest tests passing (`npm test`), Next.js production build (`npm run build`) compiled successfully with all static pages and API routes verified.
- Limitations: Entities without indexed registry snippets and on sites requiring JavaScript challenges remain inconclusive.

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
