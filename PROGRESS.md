# Progress
## Status
Current step: 10 of 10 | Last updated: 2026-10-10T22:32:30Z | Tool: Antigravity

## Steps
- [x] 1 Scaffold Next.js TS, env files, contracts.ts, rules.ts skeleton, deployable shell
- [x] 2 safe-fetch + /api/extract with OpenAI structured extraction; validate fee quotes against source text and discard fabricated quotes
- [x] 3 Input UI and Claim review UI (focus review heading after extraction)
- [x] 4 message_flags check (negation-aware) and domain_age check (WhoisXML, public-suffix-aware domain, six-month rule, creation date only)
- [x] 5 careers_match, registration, complaints checks (max 3 SerpAPI calls per scan, max 2 pages per search check, 6 total)
- [x] 6 rules.ts: scoring, coverage, label gate (Harmful override, Safe gate, Caution default) with unit tests
- [x] 7 /api/verify orchestration with NDJSON stream, timeouts, partial results, summary stage with rules fallback
- [x] 8 Results UI: dial, coverage, cards, evidence, next steps, interrupted-stream handling, fixtures
- [x] 9 Methodology section, rate limiting, log hygiene
- [x] 10 Failure tests, 320/390/desktop inspection, bundle secret scan, final report

## Files done
- docs/PROJECT_BRIEF.md: Project brief and scope requirements, done
- docs/SITEMAP.md: Navigation and state rules, done
- docs/UI_UX_SPEC.md: Presentation and token specifications, done
- docs/TECHNICAL_SPEC.md: Data contracts, timeouts, and provider adapters, done
- docs/AGENTS.md: AI pipeline, prompts, and scoring rules, done
- .env.example: Committed template with blank keys, done
- .env.local: Local uncommitted placeholder slots, done
- .gitignore: Ignores .env* except .env.example, done
- package.json: Next.js 15, React 19, Zod, Vitest, OpenAI, tldts, done
- tsconfig.json: Strict TypeScript config, done
- vitest.config.ts: Vitest config with path alias, done
- lib/env.ts: Server-only env accessor with SERPAPI_KEY/WHOISXML_KEY fallbacks, done
- lib/contracts.ts: Zod schemas and TypeScript types for full pipeline, done
- lib/rules.ts: Pure deterministic scoring, safe gate, coverage, done
- lib/prompts.ts: AGENTS.md prompts verbatim, done
- lib/rate-limit.ts: In-memory rate limiting with hashed client identifier, done
- lib/safe-fetch.ts: SSRF prevention, IP pinning, DNS resolution, redirect caps, done
- lib/providers/openai.ts: Structured extraction, quote validation, summary generation, done
- lib/providers/whoisxml.ts: WhoisXML adapter with creation-date parsing, done
- lib/providers/serpapi.ts: SerpAPI Google search adapter with error handling and link sanitization, done
- lib/checks/message-flags.ts: Check 1 message red flags and negation handling, done
- lib/checks/domain-age.ts: Check 2 domain age calculation and six-month math, done
- lib/checks/careers-match.ts: Check 3 official careers match and role verification, done
- lib/checks/registration.ts: Check 4 Indian corporate registration check, done
- lib/checks/complaints.ts: Check 5 multi-source complaint pattern detection, done
- app/api/extract/route.ts: Input validation, safe URL fetch, OpenAI extraction handler, done
- app/api/verify/route.ts: Check orchestration, NDJSON streaming, partial results, summary fallback, done
- components/Icons.tsx: Accessible SVG line-only icons (zero emojis), done
- components/InputForm.tsx: Input form with tabs, length limits, live counters, privacy notice, done
- components/ClaimReview.tsx: Claim review form with editable fields, immutable source drawer, done
- components/RiskDial.tsx: Semicircular SVG dial and visible legend (no percent sign), done
- components/CheckCard.tsx: Card showing title, status chip, finding, and expandable evidence, done
- components/ResultsSection.tsx: Verdict layout, dial, coverage, reasons, 5 cards, next steps, disclaimer, done
- components/MethodologySection.tsx: Static methodology explaining checks, scoring rules, privacy, done
- fixtures/demo-cases.ts: Four recorded demo fixtures (Safe, Likely Scam, Caution, Unavailable), done
- app/page.tsx: Single-page application orchestrating entire user journey and anchors, done
- app/globals.css: UI tokens, typography, reduced-motion, done
- app/layout.tsx: HTML shell and metadata, done
- tests/safe-fetch.test.ts: Tests for SSRF prevention, IP filtering, URL validation, done
- tests/extraction-quotes.test.ts: Tests for fee quote preservation and fabricated quote rejection, done
- tests/checks-message-domain.test.ts: Tests for Check 1 negation/signals and Check 2 leap-year date math, done
- tests/rules.test.ts: Tests for deterministic scoring rubric, safe gate, harmful override, and coverage, done
- tests/failure-and-edge-cases.test.ts: Tests for prompt injection defense, audit dates, job-board rejection, timeout, and stream interruption, done

## Decisions and doc conflicts
- Key naming: Primary names are OPENAI_API_KEY, SERPAPI_API_KEY, WHOISXML_API_KEY with fallbacks SERPAPI_KEY, WHOISXML_KEY in lib/env.ts.
- Plain CSS used with design tokens in app/globals.css.
- No emojis anywhere: SVG line icons paired with text for all indicators.
- Client bundle scan: Verified that zero API keys or environment secrets appear in the static client bundle.

## Commands
- npm run dev
- npm run build
- npm run typecheck
- npm run test

## Env
- OPENAI_API_KEY (placeholder)
- SERPAPI_API_KEY (placeholder)
- WHOISXML_API_KEY (placeholder)
- OPENAI_MODEL (placeholder)
- OPENCORPORATES_API_KEY (placeholder)

## Known issues / not tested
- Live third-party provider access (OpenAI, SerpAPI, WhoisXML live accounts) unverified unless local keys are supplied by user in .env.local. All mock flows, failure cases, and demo fixtures verified.

## Next action
Build complete. Ready for user local key configuration in .env.local and deployment.
