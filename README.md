# Job Scam Detector (Klyro)

A web application that detects recruitment fraud patterns, suspicious payment conditions, newly registered domains, uncorroborated vacancies, and public complaints using an evidence-backed, deterministic verification pipeline.

Built with Next.js App Router, React, TypeScript, Zod, and Vitest. Deployable on Vercel.

**[Submission Details](SUBMISSION.md)** · **[AI Usage Log](AI_USAGE.md)** · **[Changelog](CHANGELOG.md)** · **[Event Rules](RULES.md)** · **[Specifications](docs/PROJECT_BRIEF.md)**

---

## Overview

Job Scam Detector analyzes job postings, recruiter messages, and vacancy links to identify potential employment fraud before candidates apply or pay. 

Unlike generic sentiment-based AI tools, this system uses an evidence-grounded verification pipeline:
- AI models only perform bounded extraction and evidence summarization.
- All risk scores, coverage calculations, and final verdict labels are determined entirely by deterministic TypeScript business rules.
- During verification, the risk index and completed-check coverage update from each streamed check result; the final verdict replaces this provisional view when all four checks finish.
- The system operates strictly in-memory. Postings, candidate contacts, and links are never stored in databases, local storage, URL query parameters, or server logs.

---

## Verification Pipeline

```text
Message Text / Job URL
  -> Safe URL Fetch & SSRF Validation
  -> Extraction Provider Chain (Gemini x N -> OpenAI fallback)
  -> User Claim Review & Correction
  -> Concurrent Four-Check Execution
  -> Deterministic Scoring & Label Gates
  -> Evidence-Grounded Summary & Next Steps
  -> Streaming Result UI with Evidence Cards
```

### Extraction Provider Chain

Structured claim extraction uses a robust multi-provider fallback chain:
1. **Gemini Rotation (Primary):** Iterates through comma-separated `GEMINI_API_KEYS` in sequence using schema-constrained JSON output.
2. **OpenAI Fallback:** If all Gemini keys hit quota limits or fail, falls back to OpenAI (`gpt-4o-mini`) with the identical `ExtractedClaims` schema.
3. **Honest Unavailable:** If all providers fail or are unconfigured, returns an honest `unavailable` status (HTTP 503) without fabricating claims.
4. Once a provider succeeds for a scan, that scan is completed on that provider. All extracted fee claims are cross-checked against source text to discard fabricated quotes.

### The Four Checks

1. **Message red flags (`message_flags`)**
   - Scans posting text for candidate payment demands, mandatory paid training, coercive urgency, and recruiter contacts on free webmail domains.
   - Negation-aware: phrases such as "No registration fee" or "Never pay recruiters" are preserved and never treated as payment demands.
   - Quoted evidence is validated against immutable source text to discard fabricated quotes.

2. **Employer domain and age (`domain_age`)**
   - Extracts the public registrable domain using public-suffix-aware parsing (`tldts`), discarding job boards and webmail providers.
   - Probes domain DNS resolution and HTTP availability using safe-fetch policies.
   - Retrieves domain creation dates via WhoisXML API.
   - Computes domain age using calendar-month date math with leap-year and month-end clamping.
   - Emits `young_domain_history` only when a domain is under six months old and contradicts an explicitly claimed corporate operating history.

3. **Official careers-page match (`careers_match`)**
   - Discovers and reads employer careers portals via SerpAPI search.
   - Fetches up to 3 eligible candidate vacancy pages in parallel, with an 8-second limit per page.
   - Validates that the role and employer match the official portal.
   - Emits `careers_not_found` when a thorough lookup finds no active matching vacancy.

4. **Complaints and reviews (`complaints`)**
   - Searches public complaint records for recruitment and payment allegations.
   - Requires at least two independent, deduplicated sources to establish a reported complaint pattern (`complaint_pattern`).

---

## Deterministic Scoring Rubric

Points are computed strictly from verified evidence. Scored signals are deduplicated to at most one per code per scan.

| Signal Code | Points | Scope |
| :--- | :---: | :--- |
| `job_payment_demand` | 80 | Directly evidenced candidate payment to secure a job or interview |
| `training_job_condition` | 80 | Mandatory paid training required as a condition to get the advertised job |
| `training_guarantee` | 20 | Paid course with ambiguous placement guarantee wording |
| `urgency` | 10 | Coercive pressure to act or pay immediately |
| `free_email_hr` | 10 | Recruiter contact on a free webmail service (@gmail, @yahoo, etc.) |
| `young_domain_history` | 15 | Employer domain under 6 months old contradicting claimed longevity |
| `careers_not_found` | 10 | Completed careers lookup with no matching role found |
| `complaint_pattern` | 20 | Two or more independent sources reporting recruiting scam concerns |
| `unverified_pay` | 0 | Advertised compensation without independent market baseline |

### Verdict Gates

1. **Harmful-pattern override:**
   An accepted `job_payment_demand` or `training_job_condition` with direct quoted evidence immediately yields **Likely Scam** (`ruleId: harmful_payment_override`), regardless of corporate registration or missing external checks.
2. **Safe gate:**
   The **Safe** label (`ruleId: safe_gate`) is granted only if all core checks complete with zero scored points, the employer domain is confirmed, the role is matched on the official careers portal, and no unresolved identity gaps exist.
3. **Caution default:**
   All other cases yield **Caution** (`ruleId: caution_default`). A score of 0 with incomplete external checks correctly yields Caution: "No scored signals, but verification is incomplete."

---

## Verdict Labels

- **Safe:** "No major risk signals found in completed checks. Not a guarantee."
- **Caution:** "Some concerns or checks remain unresolved."
- **Likely Scam:** "Strong scam-pattern indicators in this posting."

---

## Architecture & Technology Stack

- **Framework:** Next.js 15 (App Router)
- **UI & Logic:** React 19, TypeScript
- **Styling:** Vanilla CSS with custom tokens (`--bg-color: #F7F8FA`, `--text-main: #17212B`, `--color-action: #0F766E`, `--color-caution: #92400E`, `--color-danger: #B91C1C`)
- **Validation:** Zod schemas for all runtime input, output, and provider contracts
- **Testing:** Vitest
- **Domain Parsing:** `tldts`
- **Streaming:** Server-Sent NDJSON (`application/x-ndjson`)

### Security & Privacy Protections

- **Server-side secrets:** API keys are read exclusively on the server through `lib/env.ts`. No `NEXT_PUBLIC_` prefixes are used for sensitive credentials.
- **SSRF Defense:** Outbound URL fetching resolves hostnames, checks resolved addresses against IPv4/IPv6 private, link-local, loopback, multicast, and cloud metadata ranges, pins the validated IP, and enforces redirect caps (3 max) and size limits (1 MiB max).
- **Stateless Operation:** No database, user accounts, persistent storage, cookies, or tracking pixels.

---

## Project Structure

```text
app/
  api/
    extract/route.ts        # Input validation, safe URL fetch, Gemini/OpenAI extraction
    verify/route.ts         # Check orchestration, NDJSON stream, rules fallback
  about/page.tsx            # About and methodology page
  globals.css               # Design tokens, typography, reduced motion
  layout.tsx                # HTML metadata and root shell
  page.tsx                  # Scan UI with review and results anchors
components/
  CheckCard.tsx             # Terminal status chips, findings, expandable evidence
  ClaimReview.tsx           # Editable claim fields and immutable source drawer
  Icons.tsx                 # Accessible inline SVG line icons (zero emojis)
  InputForm.tsx             # Text/URL modes, counters, verbatim privacy notice
  MethodologySection.tsx    # Static methodology, rules, and privacy documentation
  ResultsSection.tsx        # Dial, coverage, reasons, cards, and next steps
  RiskDial.tsx              # Semicircular SVG dial (0-100, no percent sign)
docs/
  PROJECT_BRIEF.md          # Project scope, labels, success criteria
  SITEMAP.md                # Page states and anchor specifications
  UI_UX_SPEC.md             # Visual design tokens and layout rules
  TECHNICAL_SPEC.md         # Data contracts, API specs, provider adapters
  AGENTS.md                 # Agent instructions, verbatim prompts, test cases
lib/
  checks/                   # Five verification check implementations
  providers/                # OpenAI, SerpAPI, WhoisXML provider adapters
  contracts.ts              # Zod schemas and TypeScript types
  env.ts                    # Server-only environment variable loader
  prompts.ts                # Verbatim prompt templates from AGENTS.md
  rate-limit.ts             # In-memory IP rate limiter
  rules.ts                  # Pure deterministic rule engine
  safe-fetch.ts             # SSRF prevention and IP validation
tests/                      # Vitest test suites (30 tests)
PROGRESS.md                 # Development step-by-step progress tracker
```

---

## Setup & Local Development

### Prerequisites

- Node.js 18+ (tested on Node v24.11.1)
- npm 9+

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Kokach1/klyro.git
cd klyro
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your API keys in `.env.local`:

```dotenv
# Comma-separated Gemini API keys (primary rotation)
GEMINI_API_KEYS=key1,key2
GEMINI_MODEL=gemini-1.5-flash

# Fallback extraction provider
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Verification Providers
SERPAPI_API_KEY=your_serpapi_api_key
WHOISXML_API_KEY=your_whoisxml_api_key
OPENCORPORATES_API_KEY=
```

*Note: If any external API keys are missing, the detector continues to operate. Missing checks return an explicit `unavailable` status with `missing_key` reason code, defaulting to Caution unless a harmful payment pattern is identified in the posting text.*

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Test Suites

```bash
# Run all Vitest suites
npm run test

# Run TypeScript typecheck
npm run typecheck
```

### 5. Production Build

```bash
npm run build
npm run start
```

---

## Deployment on Vercel

1. Push this repository to GitHub.
2. Import the repository into your Vercel dashboard.
3. In Project Settings -> Environment Variables, add:
   - `OPENAI_API_KEY`
   - `SERPAPI_API_KEY` (or `SERPAPI_KEY`)
   - `WHOISXML_API_KEY` (or `WHOISXML_KEY`)
   - `OPENAI_MODEL` (optional, e.g. `gpt-4o-mini`)
4. Deploy.

---

## Disclaimer

This tool reports risk signals and allegations found, not legal findings or guaranteed legitimacy.
