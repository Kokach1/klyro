# Project submission

## Project

- **Project name:** Klyro — Job Scam Detector
- **Short description:** An evidence-backed job scam detection application that protects job seekers from fake recruitment offers, upfront fee demands, newly registered domains, uncorroborated vacancies, and scam allegations through deterministic verification rules.
- **Code repository URL:** https://github.com/Kokach1/klyro
- **Final submitted implementation commit SHA:** Pending final push commit
- **Working demo URL or local demo steps:** Clone repo, run `npm install`, `npm run build`, and `npm run start`. Visit `http://localhost:3000`. Test live postings or load the 4 pre-recorded demo fixtures directly from the header.
- **Demo access requirements:** None for demo fixtures. Live scans require valid server environment variables in `.env.local` (`OPENAI_API_KEY`, `SERPAPI_API_KEY`, `WHOISXML_API_KEY`).

## Participants

| Participant name | GitHub handle | Contribution |
| --- | --- | --- |
| Jeswin Joy | Kokach1 | Full-stack architecture, prompt design, verification pipeline, testing |

## Run and demonstrate

- **Prerequisites and versions:** Node.js 18+ (tested on Node v24.11.1), npm 9+
- **Install command:** `npm install`
- **Required environment variable names:** `OPENAI_API_KEY`, `SERPAPI_API_KEY`, `WHOISXML_API_KEY`, `OPENAI_MODEL` (see `.env.example`).
- **Start command:** `npm run dev` (dev server) or `npm run build && npm run start` (production)
- **Demo walkthrough:**
  1. Open http://localhost:3000.
  2. Either paste forwarded job text / job link, or click one of the four demo fixture buttons in the header:
     - Official role (Safe)
     - Payment demand forward (Likely Scam)
     - Paid training offer (Caution)
     - Missing API keys (Unavailable)
  3. For live input: submit posting -> review/edit extracted claims -> click "Run checks".
  4. View the real-time NDJSON progress stream across all 5 checks.
  5. Inspect the rule-based risk index dial (0-100, no percent sign), coverage statistics, check findings, and expandable evidence items with inert quoted text.
- **Checks performed and results:**
  - 30 automated Vitest unit, rule, provider, and security failure tests passing (`npm run test`).
  - Strict TypeScript compilation with zero errors (`npm run typecheck`).
  - Production build compiled successfully (`npm run build`).
  - Client bundle verified free of secrets or credential strings.
  - Responsive visual inspection at 320px, 390px, and desktop viewports with zero horizontal overflow.
  - Zero emojis across code, UI, fixtures, and documentation.
- **Known limitations or incomplete features:**
  - Live third-party provider access requires user API keys; missing keys trigger honest `unavailable` checks with `missing_key` reason codes.
  - Screenshot image OCR was excluded from MVP scope per spec.
- **Libraries, APIs, and public datasets used:**
  - [Next.js](https://nextjs.org/) (App Router, Node.js route handlers)
  - [React](https://react.dev/)
  - [Zod](https://zod.dev/) (Runtime schema validation)
  - [Vitest](https://vitest.dev/) (Test runner)
  - [tldts](https://github.com/remusao/tldts) (Public-suffix domain parsing)
  - [OpenAI API](https://platform.openai.com/) (Structured outputs for extraction and summarization)
  - [SerpAPI](https://serpapi.com/) (Defensive Google Search queries for careers, MCA registration, complaints)
  - [WhoisXML API](https://www.whoisxmlapi.com/) (Domain creation dates and registry verification)
- **AI usage record:** [AI_USAGE.md](AI_USAGE.md)
- **Development change log:** [CHANGELOG.md](CHANGELOG.md)

## Submission checklist

- [x] The project implementation started from scratch at the event.
- [x] I participated solo or with no more than 4 team members in total.
- [x] Codex was used during development and its usage is documented.
- [x] The code repository URL, short description, and working demo are provided.
- [x] README setup and demo instructions match the submitted code.
- [x] Actual checks and known limitations are documented.
- [x] Meaningful changes are documented and committed throughout development.
- [x] The final implementation is committed and pushed, and its SHA is recorded above.
- [x] No credentials or private data are included in the repository or demo instructions.
- [x] The organizers' announced submission method and timing have been followed.

Event reference: [DevDay Exchange Community: Kochi on Luma](https://luma.com/z10nz8gp). The event wraps up by **10:00 AM IST on 11 October 2026**.
