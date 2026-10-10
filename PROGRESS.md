# Progress
## Status
Current step: 1 of 10 | Last updated: 2026-10-10T21:49:00Z | Tool: Antigravity

## Steps
- [ ] 1 Scaffold Next.js TS, env files, contracts.ts, rules.ts skeleton, deployable shell
- [ ] 2 safe-fetch + /api/extract with OpenAI structured extraction; validate fee quotes against source text and discard fabricated quotes
- [ ] 3 Input UI and Claim review UI (focus review heading after extraction)
- [ ] 4 message_flags check (negation-aware) and domain_age check (WhoisXML, public-suffix-aware domain, six-month rule, creation date only)
- [ ] 5 careers_match, registration, complaints checks (max 3 SerpAPI calls per scan, max 2 pages per search check, 6 total)
- [ ] 6 rules.ts: scoring, coverage, label gate (Harmful override, Safe gate, Caution default) with unit tests
- [ ] 7 /api/verify orchestration with NDJSON stream, timeouts, partial results, summary stage with rules fallback
- [ ] 8 Results UI: dial, coverage, cards, evidence, next steps, interrupted-stream handling, fixtures
- [ ] 9 Methodology section, rate limiting, log hygiene
- [ ] 10 Failure tests, 320/390/desktop inspection, bundle secret scan, final report

## Files done
- None yet

## Decisions and doc conflicts
- Key naming: Primary names are OPENAI_API_KEY, SERPAPI_API_KEY, WHOISXML_API_KEY with fallbacks SERPAPI_KEY, WHOISXML_KEY in lib/env.ts.
- Plain CSS / CSS modules used for styling per spec, with design tokens in globals.css.
- No emojis anywhere: SVG line icons paired with text for all indicators.

## Commands
- npm run dev
- npm run test
- npm run lint
- npm run typecheck

## Env
- OPENAI_API_KEY (placeholder)
- SERPAPI_API_KEY (placeholder)
- WHOISXML_API_KEY (placeholder)
- OPENAI_MODEL (placeholder)
- OPENCORPORATES_API_KEY (placeholder)

## Known issues / not tested
- Initial repository scaffolding in progress.

## Next action
Scaffold Next.js TypeScript project, populate docs/, setup environment files and contracts.ts.
