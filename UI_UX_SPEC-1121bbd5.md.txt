# Job Scam Detector: UI and UX specification

## Visual direction
Use a restrained light interface: white cards on a very pale neutral page, dark charcoal text, teal for actions and corroborated evidence, amber for caution, red for strong payment-pattern warnings. Use a system sans-serif stack. Do not add gradients, glass effects, neon glow, stock illustrations, oversized hero copy, decorative chatbots, or a generic AI sparkle icon.

Suggested app tokens: background `#F7F8FA`, surface `#FFFFFF`, text `#17212B`, secondary `#4B5563`, divider `#D9DEE5`, action `#0F766E`, caution `#92400E`, danger `#B91C1C`. Verify contrast in the implemented UI; these are app design choices, not provider requirements.

Use an 8px spacing grid, 12px card radius, 16px mobile gutters and 24px section gaps. Keep body text at least 16px, metadata at least 13px, line height 1.5, and controls at least 44px high. Desktop content width is at most 960px. Stack all cards on phones; use two columns only where the content comfortably fits. Long titles, email addresses, CIN values and URLs must wrap.

## Header and input
Show "Job Scam Detector" and a small Methodology link. Intro: "Check a job post before you apply or pay."

Provide two labelled input modes:
- Message text: multiline textarea, about 8 lines on mobile; placeholder "Paste the full forwarded job message".
- Job link: URL input; placeholder "Paste a public job posting URL".

Show an input-length counter near the limit. Show errors below the relevant input and associate them with `aria-describedby`. Never erase an invalid entry. Primary action is Analyse. Keep it disabled for empty input or while a request is active.

Before submission show: "Your posting is sent to AI services. Company/domain search terms are sent to search providers. This app does not save your posting or contact details. Remove sensitive information before submitting." Do not imply third-party providers retain nothing.

## Claim review
After extraction, scroll and focus the review heading. Display labelled editable fields rather than a raw JSON block. Use "Unknown" hints for missing fields. Separate company identity/domain from contact addresses to avoid treating a Gmail address as the employer domain.

Show a compact source-text disclosure and fee quotes. Preserve original source text internally. Corrections update structured lookup context, not the original quotations. Present "Edit posting" and primary "Run checks". Explain uncertain company/domain candidates and avoid preselecting an unrelated same-name company.

## Progress
On Run checks, scroll to the results heading and show all five cards immediately. Each card uses Pending, Running, or its final status. Use an indeterminate indicator only while its own task is running. Show check completion based on received events, not timers. Do not show invented "84% complete" progress.

Use `aria-live="polite"` for a compact progress summary. Do not repeatedly move keyboard focus as individual cards finish. Disable duplicate scans while active. A retry is a new scan and may use provider quota.

## Verdict layout
Order content as follows:
1. Posting-risk label and its exact qualifying sentence from PROJECT_BRIEF.md.
2. Compact semicircular or circular dial labelled "Rule-based risk index", with integer `0-100` and visible legend "Higher = more observed risk signals. Not a probability." Do not append a percent sign. If rule evaluation failed, show "Unavailable", not zero.
3. Coverage: "X of 5 checks completed", followed by counts of inconclusive, unavailable and not applicable. A check can be completed and still report uncertainty in its finding; domain partial data uses inconclusive under AGENTS.md.
4. Main reasons, linked to check cards and evidence.
5. Five check cards.
6. Practical next steps and the fixed disclaimer.

Safe uses teal, Caution amber, Likely Scam red. Always pair colors with text and icons. An index of 0 with Caution is valid: explain "No scored signals, but verification is incomplete." Never convert it into a Safe verdict to make the dial look consistent.

## Check cards
Each card shows name, terminal status chip, plain finding, why it matters, check time and expandable supporting evidence. Keep the finding, status and missing-data reason visible without expansion.

- Completed: "Completed" chip, even when the finding is a risk signal.
- Inconclusive: "Inconclusive" chip and explanation such as identity ambiguity or inaccessible role detail.
- Unavailable: explicit "Check unavailable" chip plus reason: missing key, quota, timeout, blocked page, provider error or missing data.
- Not applicable: "Not applicable" chip and the exact reason. Do not style it as a passed check.

Render quoted evidence as inert text with source label. Show external evidence title/domain, retrieved time and published date where available. Open relevant public source links in a new tab with `rel="noopener noreferrer"`. Never expose provider request URLs that contain API keys. Distinguish "Search snippet only" from "Page read" and "Anonymous allegation" from "Official finding". Use neutral phrasing for allegations.

## Failure and empty states
- URL blocked: offer Paste text; retain URL for reference.
- Missing company: permit review correction; dependent checks cannot silently match an arbitrary organization.
- Provider timeout/quota: complete other checks and show an unavailable reason.
- No careers match: "No matching role found in the sources checked. It may be expired, unlisted or inaccessible."
- No complaints: "No relevant complaints found in the sources checked." Never "No complaints exist".
- Summary model failed: render deterministic findings, labels and next steps; disclose that the generated explanation is unavailable.
- Interrupted stream: retain completed cards, mark unresolved ones unavailable and recompute a conservative partial verdict.
- Direct result anchor without state: "No check in this session" and Start a check.

## Privacy and honesty
Do not put posting text in browser URL parameters, localStorage, analytics or error reports. Do not display a green shield or "verified employer" badge. Place this text below every verdict: "This tool reports risk signals and allegations found, not legal findings or guaranteed legitimacy."

For demo fixtures, show a persistent "Demo fixture - recorded evidence, not a live check" banner and the recording timestamp. No fixture must appear as a live API response.

## Acceptance checks
Inspect the actual running page at 320px, 390px and desktop width. Test long company names, URL wrapping, five unavailable cards, unknown extracted fields, keyboard navigation, screen-reader labels, focus after extraction, disabled duplicate submissions, red payment evidence and a score-zero Caution result. Require no horizontal page overflow. Respect reduced-motion preferences. Do not ship a screenshot upload control unless the OCR stretch goal is fully implemented and its review step works.
