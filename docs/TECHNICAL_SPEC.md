# Job Scam Detector: technical specification

## Architecture and ownership
Implement Next.js App Router, React, TypeScript and Node.js server route handlers on Vercel. Use plain CSS or the team's existing styling setup. Do not add Express, MongoDB, authentication, job queues or persistent storage.

Use the browser's in-memory state for input, extraction review, progress events and the final result. Keep provider requests inside server code. AGENTS.md owns signal detection and decision rules; this document owns contracts and limits. Both must agree before code is merged.

Suggested modules:
```text
app/page.tsx                 single-page flow and anchors
app/api/extract/route.ts     input validation, safe URL fetch, extraction
app/api/verify/route.ts      check orchestration and optional NDJSON stream
components/                 InputForm, ClaimReview, RiskDial, CheckCard
lib/contracts.ts            schemas and TypeScript types
lib/safe-fetch.ts            public URL/DNS/redirect validation
lib/providers/              openai.ts, serpapi.ts, whoisxml.ts
lib/checks/                 four modules with fixed check IDs
lib/rules.ts                pure signal scoring, coverage and label gate
lib/prompts.ts              app extraction/evaluation/summary prompts
tests/                     rule, provider failure and flow tests
```

## Environment and provider setup
Required secrets:
```dotenv
GEMINI_API_KEYS=
OPENAI_API_KEY=
SERPAPI_KEY=
WHOISXML_KEY=
```
Optional configuration: `GEMINI_MODEL`, `OPENAI_MODEL`, `OPENCORPORATES_API_KEY`. Fail safely if model access is unconfirmed. Do not hardcode a claimed hackathon model or assume coding-tool credits are an API key.

Use `.env.local` for local secrets and Vercel server environment variables for deployment. Commit only blank `.env.example`; gitignore `.env*` except that example. Never use `NEXT_PUBLIC_` for secrets. Never include user-pasted keys in code, fixtures, screenshots, responses, telemetry or files. If a key was pasted into chat, rotate it before deployment. WHOIS sample JSON is response data, not a credential.

Extraction provider chain:
- Primary: try `GEMINI_API_KEYS` in order (comma-separated list of keys rotated sequentially).
- Fallback: if all Gemini keys are quota-limited or fail, fall back to OpenAI (`gpt-4o-mini`) using `OPENAI_API_KEY` with structured outputs and the exact same `ExtractedClaims` schema.
- Unavailable: if OpenAI also fails or is unconfigured, return extraction `unavailable` with an honest reason (HTTP 503); never fake a result.
- Identical schema validation and fee quote verification applies to both providers. Once a provider succeeds for a scan, finish that scan on it.

Provider adapters:
- Gemini: POST `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with JSON `responseSchema` constrained to `ExtractedClaims`. Detect 429 / RESOURCE_EXHAUSTED and rotate keys.
- OpenAI: server SDK Responses / Chat Completions API with schema-constrained structured output for fallback extraction and summaries.
- SerpAPI: GET `https://serpapi.com/search` with URLSearchParams `engine=google`, `q`, `api_key`, `output=json`, `gl=in`, `hl=en`. Parse `organic_results` defensively; use title/link/snippet as discovery leads, not automatically verified facts. Validate errors even on HTTP 200. Never expose a credential-bearing search URL. Build every query from the extracted company name wrapped in double quotes; do not include personal phones or recruiter email.
- WhoisXML: POST `https://www.whoisxmlapi.com/whoisserver/WhoisService` with JSON `apiKey`, `domainName`, `outputFormat: "JSON"`. Parse the `WhoisRecord` wrapper and `registryData` fallback. Inspect provider errors as well as HTTP status. Use creation date, not audit/updated/expiry dates, to calculate age. Treat privacy masking separately from a missing date.
- OpenCorporates: optional adapter only after access and licensing are confirmed. Search fallback remains the default without a key; it does not require a fourth search call.

## Proposed limits
These are explicit implementation defaults for the MVP, not provider guarantees:
- Raw text: 20,000 Unicode characters. URL: 2,048 characters. Reviewed string fields: at most 500 characters each; contacts/links: at most 10 each.
- URL extraction: 8-second fetch limit, 1 MiB decompressed-body limit, at most 3 redirects. Accept text/HTML only; offer pasted text for PDFs, login walls or unreadable pages.
- Give each SerpAPI lookup a 7-second budget, then select at most 3 candidate pages per search check after the domain filter and fetch them concurrently with an 8-second limit per page. Return inconclusive immediately when no candidate survives filtering. Limit each sanitized page excerpt to 8,000 characters. Retain exact evidence quotes with offsets in the bounded excerpt.
- Extraction/model request timeout: 15 seconds. Each verification check: 15 seconds total, including its provider call and bounded page reads. Summarization: 10 seconds. Entire verify request: 40 seconds with cancellation and partial results before the deadline. Configure a 60-second route budget only if the actual Vercel account supports it; verify this at deployment. Reduce internal budgets if it does not.
- Run independent checks concurrently. Reuse domain candidates from careers discovery; if that dependency consumes the domain budget, report timeout rather than extending indefinitely. Use abort signals and `Promise.allSettled` or equivalent bounded orchestration.
- No automatic retries in the initial build. One user-triggered retry starts a new request and consumes quota.
- At most one active scan in each UI. Add a best-effort per-instance server limit of 5 extraction and 5 verify requests per IP per minute with short-lived in-memory counters, without storing raw IPs in logs. This is not reliable cross-instance enforcement. Use deployment-level rate limiting if available and keep provider budgets capped. Do not claim abuse protection is complete.

## Input retrieval and source safety
Accept absolute public HTTP(S) URLs only. Reject embedded user credentials, private/reserved/internal IP ranges, loopback, localhost, link-local, multicast, IPv6 equivalents, cloud metadata addresses and non-HTTP protocols. Resolve every hostname and reject any non-public resolved address. Recheck each redirect before following it.

Use a fetch implementation that pins the validated resolution or checks the actual connected address, so DNS rebinding cannot bypass validation. A hostname precheck followed by an unrestricted fetch is insufficient. If the deployment cannot safely enforce this, disable URL fetching and offer pasted text; do not ship an unsafe fetch proxy.

Apply this policy to user links, search-result pages, hiring portals and domain-response probes. Limit redirects, bytes, time and content type after every request. Strip scripts/styles/navigation and treat extracted text as untrusted data. Render escaped strings; do not use unsanitized HTML. Do not run instructions embedded in a posting or webpage.

Check DNS existence separately from HTTP response. A 403, CAPTCHA, 429 or login wall is blocked access, not proof a domain is nonexistent. Compute the registrable employer domain using a public-suffix-aware parser. Do not check `linkedin.com` or a job board as the employer, or use a free-email provider as the company domain.

## API: extraction
`POST /api/extract`, JSON body:
```ts
type ExtractRequest = { inputType: "text" | "url"; input: string };
type ExtractedClaims = {
  companyName: string | null;
  role: string | null;
  salary: string | null;
  location: string | null;
  contacts: Array<{ kind: "email" | "phone" | "other"; value: string }>;
  links: string[];
  employerDomain: string | null;
  claimedOperatingYears: number | null;
  feeClaims: Array<{ quote: string; kind: "demand" | "negated" | "training_offer" | "unclear" }>;
};
type ExtractResponse = {
  source: { inputType: "text" | "url"; url: string | null; text: string; retrievedAt: string };
  extracted: ExtractedClaims;
  warnings: string[];
};
```
Return bounded source text to the browser for review. It is not persisted. Fields are nullable rather than guessed. The user may correct structured fields, but direct message evidence must always cite the original source text.

## API: verification
`POST /api/verify`, JSON body:
```ts
type VerifyRequest = {
  source: ExtractResponse["source"];
  extracted: ExtractedClaims; // user-reviewed values; still untrusted input
};
```
Validate lengths, URLs, enums and at least a nonempty company name or role. Do not treat a user-editable domain as official without corroboration. Client-supplied source text is the posting being analyzed, not authenticated authorship. Do not refetch an arbitrary `source.url` just because it accompanies text.

Default response: `application/json` with `VerdictResponse`. To show honest per-check progress, the same route also supports `Accept: application/x-ndjson`; emit one JSON object per line:
```ts
type StreamEvent =
  | { type: "check_started"; checkId: CheckId }
  | { type: "check_result"; check: CheckResult }
  | { type: "final"; result: VerdictResponse };
```
Start events reflect actual execution; do not send fake timer progress. On an interrupted stream, mark missing checks unavailable with `interrupted`, run the same deterministic rules locally, and clearly identify the partial result. Keep the rule engine shared between server and client without importing provider code or secrets into client bundles.

## Final JSON contract
Define runtime validation (for example Zod) for this exact contract. Timestamps use UTC ISO 8601; null means unknown. Arrays may be empty. Check IDs must occur exactly once in the stated order.
```ts
type CheckId = "message_flags" | "domain_age" | "careers_match" | "complaints";
type CheckStatus = "completed" | "inconclusive" | "unavailable" | "not_applicable";
type ReasonCode = "missing_key" | "timeout" | "quota" | "blocked_page" | "missing_data"
  | "provider_error" | "ambiguous_identity" | "no_domain" | "not_indian_company"
  | "interrupted" | "budget_exceeded";
type Evidence = {
  id: string;
  kind: "input_quote" | "page" | "search_snippet" | "registry" | "whois";
  title: string;
  url: string | null; // only a public, retrieved source URL; null for input/provider-only data
  quote: string | null;
  provider: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  classification: "posting_claim" | "corroboration" | "allegation" | "official_finding" | "unknown";
};
type SignalCode = "job_payment_demand" | "training_job_condition" | "training_guarantee"
  | "urgency" | "free_email_hr" | "unverified_pay" | "young_domain_history"
  | "careers_not_found" | "complaint_pattern";
type Signal = { code: SignalCode; points: number; evidenceIds: string[]; explanation: string };
type CheckResult = {
  id: CheckId;
  status: CheckStatus;
  reasonCode: ReasonCode | null;
  reason: string | null;
  finding: string;
  whyItMatters: string;
  checkedAt: string;
  evidence: Evidence[];
  signals: Signal[];
  facts: {
    domain: string | null;
    domainOfficialConfirmed: boolean;
    domainResponse: "responds" | "blocked" | "not_resolved" | "unknown" | null;
    domainCreatedAt: string | null;
    domainAgeDays: number | null;
    domainYoung: boolean | null;
    roleMatched: boolean | null;
    legalName: string | null;
    cin: string | null;
    identityMatch: "high" | "ambiguous" | "none" | "not_applicable";
  };
};
type VerdictResponse = {
  schemaVersion: "1.0";
  mode: "live";
  analyzedAt: string;
  extracted: ExtractedClaims;
  verdict: {
    label: "Safe" | "Caution" | "Likely Scam";
    ruleId: "harmful_payment_override" | "safe_gate" | "caution_default";
    riskIndex: number; // integer 0..100, never a probability
    labelExplanation: string;
    summary: string;
    summarySource: "model" | "rules";
  };
  coverage: { total: 5; completed: number; inconclusive: number; unavailable: number; notApplicable: number };
  checks: CheckResult[];
  nextSteps: string[];
  disclaimer: string;
};
```
Use neutral null/false defaults for irrelevant fact fields. `false` for `domainOfficialConfirmed` means not established, not disproven. Coverage counts sum to four. Invalid check output becomes an unavailable check, never a clean check. Check-specific unknowns are expressed in status/reason, not silently omitted.

Errors before verification begins use `{ error: { code: string, message: string, retryable: boolean } }`. Use 400 for validation, 413 for size, 429 for rate limiting, 422 for unreadable URL/extraction failure, and 503 for extraction service unavailable. Missing keys for verification checks yield HTTP 200 partial results, not total failure. If summarization fails, retain the deterministic verdict and rule-based summary.

## Queries and evidence handling
Construct queries from the extracted company name only; do not let input inject provider parameters:
- Careers: `"<company>" careers`.
- Complaints: `"<company>" scam OR complaint OR review`.

Read selected result pages before reporting verified facts. Preserve relevant quotes from those pages. If pages are blocked, label snippets as snippets and use inconclusive/unavailable rather than claiming verification. Deduplicate URLs and copied allegation narratives; repeated snippets are not independent reports. Do not return a provider's credential-bearing `serpapi_link` as evidence.

## Tests and deployment
Use mocked provider adapters for automated tests; never burn real quota during unit tests. Test each signal and negation case in AGENTS.md, ambiguous entities, wrong job-board domain, masked WHOIS dates, search snippets without page access, timeouts, quota, malformed JSON, blocked URL redirects, IPv6/private hosts and HTML escaping.

Deploy a shell early; set environment variables; verify actual function duration support and model availability. Inspect the built browser bundle for secrets and test both input paths on the real deployment. Rehearse with current public job postings and clearly marked test messages. Do not substitute recorded fixtures for a live scan.

Source of scope: attached requirements PDF dated 10 October 2026. Provider mechanics checked against these official pages on that date:
- https://serpapi.com/search-api
- https://whois.whoisxmlapi.com/documentation/making-requests
- https://platform.openai.com/docs/guides/structured-outputs

Provider access, costs, coverage and production robustness remain setup checks; this spec does not claim the API keys were tested or the detector's accuracy was validated.
