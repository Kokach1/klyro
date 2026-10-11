import { z } from "zod";

// --- Extraction Contract ---

export const ContactItemSchema = z.object({
  kind: z.enum(["email", "phone", "other"]),
  value: z.string().max(500),
});
export type ContactItem = z.infer<typeof ContactItemSchema>;

export const FeeClaimKindSchema = z.enum(["demand", "negated", "training_offer", "unclear"]);
export type FeeClaimKind = z.infer<typeof FeeClaimKindSchema>;

export const FeeClaimSchema = z.object({
  quote: z.string().max(1000),
  kind: FeeClaimKindSchema,
});
export type FeeClaim = z.infer<typeof FeeClaimSchema>;

export const ExtractedClaimsSchema = z.object({
  companyName: z.string().max(500).nullable(),
  role: z.string().max(500).nullable(),
  salary: z.string().max(500).nullable(),
  location: z.string().max(500).nullable(),
  contacts: z.array(ContactItemSchema).max(10),
  links: z.array(z.string().url().or(z.string().max(2048))).max(10),
  employerDomain: z.string().max(500).nullable(),
  claimedOperatingYears: z.number().int().nonnegative().nullable(),
  feeClaims: z.array(FeeClaimSchema),
});
export type ExtractedClaims = z.infer<typeof ExtractedClaimsSchema>;

export const ExtractRequestSchema = z.object({
  inputType: z.enum(["text", "url"]),
  input: z.string().min(1).max(20000),
});
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const ExtractSourceSchema = z.object({
  inputType: z.enum(["text", "url"]),
  url: z.string().url().nullable(),
  text: z.string().max(25000),
  retrievedAt: z.string(),
});
export type ExtractSource = z.infer<typeof ExtractSourceSchema>;

export const ExtractResponseSchema = z.object({
  source: ExtractSourceSchema,
  extracted: ExtractedClaimsSchema,
  warnings: z.array(z.string()),
});
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

// --- Verification Contract ---

export const VerifyRequestSchema = z.object({
  source: ExtractSourceSchema,
  extracted: ExtractedClaimsSchema.refine(
    (claims) => (claims.companyName && claims.companyName.trim().length > 0) || (claims.role && claims.role.trim().length > 0),
    { message: "At least company name or role must be provided for verification." }
  ),
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

// --- Check and Evidence Contract ---

export const CheckIdSchema = z.enum([
  "message_flags",
  "domain_age",
  "careers_match",
  "complaints",
]);
export type CheckId = z.infer<typeof CheckIdSchema>;

export const CHECK_IDS_ORDERED: readonly CheckId[] = [
  "message_flags",
  "domain_age",
  "careers_match",
  "complaints",
] as const;

export const CheckStatusSchema = z.enum([
  "completed",
  "inconclusive",
  "unavailable",
  "not_applicable",
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const CheckTierSchema = z.enum([
  "verified",
  "corroborated",
  "inconclusive",
]);
export type CheckTier = z.infer<typeof CheckTierSchema>;

export const ReasonCodeSchema = z.enum([
  "missing_key",
  "timeout",
  "quota",
  "blocked_page",
  "missing_data",
  "provider_error",
  "ambiguous_identity",
  "no_domain",
  "not_indian_company",
  "interrupted",
  "budget_exceeded",
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const EvidenceKindSchema = z.enum([
  "input_quote",
  "page",
  "search_snippet",
  "registry",
  "whois",
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceClassificationSchema = z.enum([
  "posting_claim",
  "corroboration",
  "allegation",
  "official_finding",
  "unknown",
]);
export type EvidenceClassification = z.infer<typeof EvidenceClassificationSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  kind: EvidenceKindSchema,
  title: z.string(),
  url: z.string().url().nullable(),
  quote: z.string().nullable(),
  provider: z.string().nullable(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  classification: EvidenceClassificationSchema,
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SignalCodeSchema = z.enum([
  "job_payment_demand",
  "training_job_condition",
  "training_guarantee",
  "urgency",
  "free_email_hr",
  "unverified_pay",
  "young_domain_history",
  "careers_not_found",
  "complaint_pattern",
]);
export type SignalCode = z.infer<typeof SignalCodeSchema>;

export const SignalSchema = z.object({
  code: SignalCodeSchema,
  points: z.number().int().min(0).max(100),
  evidenceIds: z.array(z.string()),
  explanation: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const CheckFactsSchema = z.object({
  domain: z.string().nullable(),
  domainOfficialConfirmed: z.boolean(),
  domainResponse: z.enum(["responds", "blocked", "not_resolved", "unknown"]).nullable(),
  domainCreatedAt: z.string().nullable(),
  domainAgeDays: z.number().int().nullable(),
  domainYoung: z.boolean().nullable(),
  roleMatched: z.boolean().nullable(),
  legalName: z.string().nullable(),
  cin: z.string().nullable(),
  identityMatch: z.enum(["high", "ambiguous", "none", "not_applicable"]),
});
export type CheckFacts = z.infer<typeof CheckFactsSchema>;

export const CheckResultSchema = z.object({
  id: CheckIdSchema,
  status: CheckStatusSchema,
  tier: CheckTierSchema.optional().nullable(),
  reasonCode: ReasonCodeSchema.nullable(),
  reason: z.string().nullable(),
  finding: z.string(),
  whyItMatters: z.string(),
  checkedAt: z.string(),
  evidence: z.array(EvidenceSchema),
  signals: z.array(SignalSchema),
  facts: CheckFactsSchema,
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const VerdictLabelSchema = z.enum(["Safe", "Caution", "Likely Scam"]);
export type VerdictLabel = z.infer<typeof VerdictLabelSchema>;

export const RuleIdSchema = z.enum([
  "harmful_payment_override",
  "safe_gate",
  "caution_default",
]);
export type RuleId = z.infer<typeof RuleIdSchema>;

export const VerdictDetailsSchema = z.object({
  label: VerdictLabelSchema,
  ruleId: RuleIdSchema,
  riskIndex: z.number().int().min(0).max(100),
  labelExplanation: z.string(),
  summary: z.string(),
  summarySource: z.enum(["model", "rules"]),
});
export type VerdictDetails = z.infer<typeof VerdictDetailsSchema>;

export const CoverageSchema = z.object({
  total: z.literal(4),
  completed: z.number().int().min(0).max(4),
  inconclusive: z.number().int().min(0).max(4),
  unavailable: z.number().int().min(0).max(4),
  notApplicable: z.number().int().min(0).max(4),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const VerdictResponseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  mode: z.literal("live"),
  analyzedAt: z.string(),
  extracted: ExtractedClaimsSchema,
  verdict: VerdictDetailsSchema,
  coverage: CoverageSchema,
  checks: z.array(CheckResultSchema).length(4),
  nextSteps: z.array(z.string()),
  disclaimer: z.string(),
});
export type VerdictResponse = z.infer<typeof VerdictResponseSchema>;

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("check_started"),
    checkId: CheckIdSchema,
  }),
  z.object({
    type: z.literal("check_result"),
    check: CheckResultSchema,
  }),
  z.object({
    type: z.literal("final"),
    result: VerdictResponseSchema,
  }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
