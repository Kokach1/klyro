# Job Scam Detector: sitemap

## Navigation decision
Keep extraction, correction, checking and results in client memory at `/`. Use anchors for scan sections, not separate persisted result routes. The static About and Methodology content lives at `/about`. Refreshing the scan page resets the scan. Do not invent `/results/:id`, history, account or dashboard pages.

| Address | Purpose | Required states |
| --- | --- | --- |
| `/` | Landing and input | Empty, editable text/URL input, validation error, extracting, URL blocked, extraction failed |
| `/#review` | Review extracted claims | Ready for correction, unknown fields, identity ambiguity, validation error, submitting |
| `/#results` | Progress and verdict | Pending, per-check running, completed result, partial result, all providers unavailable, interrupted scan |
| `/about` | About and methodology | Static explanation of five checks, rules, label caveats, privacy and provider limitations |

Scan anchors scroll within the same document. Opening a scan anchor without state must show a short empty state with "Start a check"; it must not fetch a previous user's result. Keep About and Methodology accessible without scanning.

## `/`: input section
Show the title, one-sentence purpose, a two-option "Message text" / "Job link" selector, its input, privacy notice and "Analyse" button. Default to message text. Accept no attachments in the initial MVP.

- Empty: explain what to paste; disable Analyse for whitespace-only input.
- Invalid URL: require an absolute public HTTP(S) URL; preserve the user's entry.
- Too long: show the actual limit from TECHNICAL_SPEC.md.
- Extracting: prevent duplicate submissions; retain the input; show "Reading the posting".
- Fetch blocked/unreadable: show "We could not read this link. Paste the job text instead." Do not label the posting risky solely because it is blocked.
- Extraction failed: show a plain failure reason and Retry. Never invent extracted fields.

## `/#review`: extracted claims section
Show company, role, salary, location, contacts, employer domain, links, fee claims and claimed years of operation. Render unknown as "Unknown", not an empty verified-looking value. Let users correct unclear fields before Run checks. Let them return to input and start over.

The original source text remains immutable for quote-based flags. Editable identity fields guide lookups; edits cannot erase a payment demand in the original posting. If the wrong post was supplied, require a new input instead.

Require at least a nonempty company name or role for verification. Unknown company identity is allowed but dependent checks must report inconclusive. Run checks does not imply the user has authenticated the recruiter or company domain.

## `/#results`: progress and verdict section
Render all five cards immediately in this fixed order:
1. Message red flags (`message_flags`).
2. Company domain and age (`domain_age`).
3. Official careers-page match (`careers_match`).
4. Indian company registration (`registration`).
5. Complaints and reviews (`complaints`).

Pending and running are UI-only states. Terminal data statuses are `completed`, `inconclusive`, `unavailable`, `not_applicable`.

- Running: show actual events from the response stream. Do not claim a check completed before its result arrives.
- Completed: show label, dial, rule-based risk index, coverage, reasons, evidence, timestamps and next steps.
- Partial: show the same layout with explicit missing-check chips and reasons. No silent hiding.
- All external providers unavailable: show completed local message analysis where possible; label Caution unless the harmful-pattern override applies. Explain that external verification did not finish.
- Stream interrupted: retain received cards, mark unresolved cards unavailable with `interrupted`, and show Retry. Do not display a final result without recomputing the rules from the partial checks.
- New check: clear old results and return focus to the input.

## `/about`: static page
Explain what each check does, the deterministic scoring rules, the Safe gate and limitations. Link to the exact rules presented in AGENTS.md through an on-page summary, not to private build files. Describe submission to AI/search providers, no app-side storage, and no guarantee of legitimacy. Keep the fixed disclaimer visible on the result as well as here.

## API routes, not user pages
- `POST /api/extract`: read input and return structured claims plus bounded source text.
- `POST /api/verify`: run five checks and return the final verdict or stream progress plus that verdict.

Do not add a persistent status endpoint or background queue. TECHNICAL_SPEC.md defines both contracts.
