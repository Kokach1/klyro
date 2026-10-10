# Progress
## Status
Current step: 3 of 10 | Last updated: 2026-10-10T21:59:45Z | Tool: Antigravity

## Steps
- [x] 1 Scaffold Next.js TS, env files, contracts.ts, rules.ts skeleton, deployable shell
- [x] 2 safe-fetch + /api/extract with OpenAI structured extraction; validate fee quotes against source text and discard fabricated quotes
- [ ] 3 Input UI and Claim review UI (focus review heading after extraction)
- [ ] 4 message_flags check (negation-aware) and domain_age check (WhoisXML, public-suffix-aware domain, six-month rule, creation date only)
- [ ] 5 careers_match, registration, complaints checks (max 3 SerpAPI calls per scan, max 2 pages per search check, 6 total)
- [ ] 6 rules.ts: scoring, coverage, label gate (Harmful override, Safe gate, Caution default) with unit tests
- [ ] 7 /api/verify orchestration with NDJSON stream, timeouts, partial results, summary stage with rules fallback
- [ ] 8 Results UI: dial, coverage, cards, evidence, next steps, interrupted-stream handling, fixtures
- [ ] 9 Methodology section, rate limiting, log hygiene
- [ ] 10 Failure tests, 320/390/desktop inspection, bundle secret scan, final report

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
- app/api/extract/route.ts: Input validation, safe URL fetch, OpenAI extraction handler, done
- tests/safe-fetch.test.ts: Tests for SSRF prevention, IP filtering, URL validation, done
- tests/extraction-quotes.test.ts: Tests for fee quote preservation and fabricated quote rejection, done
- app/globals.css: UI tokens, typography, reduced-motion, done
- app/layout.tsx: HTML shell and metadata, done
- app/page.tsx: Deployable shell, done

## Decisions and doc conflicts
- Key naming: Primary names are OPENAI_API_KEY, SERPAPI_API_KEY, WHOISXML_API_KEY with fallbacks SERPAPI_KEY, WHOISXML_KEY in lib/env.ts.
- Plain CSS used with design tokens in app/globals.css.
- No emojis anywhere: SVG line icons paired with text for all indicators.

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
- Live API keys not set in environment (mock fixtures and fallback rule engines are tested).

## Next action
Build components/InputForm.tsx and components/ClaimReview.tsx with accessible form controls, validation, source text drawer, and focus management.
