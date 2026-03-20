import { z } from 'zod';

export const cryptoGuardrailDecisionTypeSchema = z.enum(['allow', 'approve', 'deny', 'simulate']);
export const cryptoGuardrailSubjectTypeSchema = z.enum(['tool_call', 'workflow_run']);
export const cryptoGuardrailActionTypeSchema = z.enum([
  'none',
  'wallet_read',
  'wallet_transfer',
  'wallet_write',
  'payment',
  'trading',
  'swap',
  'approval',
  'unknown',
]);
export const cryptoCapStatusSchema = z.enum([
  'not_applicable',
  'within_cap',
  'over_cap',
  'missing_amount',
  'missing_config',
]);
export const cryptoAllowlistStatusSchema = z.enum([
  'not_applicable',
  'allowlisted',
  'not_allowlisted',
  'missing_destination',
]);

export const cryptoRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const cryptoGuardrailConfigSchema = z.object({
  defaultDecision: z.enum(['simulate', 'deny']).default('simulate'),
  perTransactionUsdCapCents: z.number().int().nonnegative(),
  dailyUsdCapCents: z.number().int().nonnegative(),
  enforceDestinationAllowlist: z.boolean(),
  blockScheduledCrypto: z.boolean(),
});

export const cryptoDestinationAllowlistEntrySchema = z.object({
  destination: z.string().min(1),
  asset: z.string().min(1).optional(),
  chain: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  active: z.boolean().default(true),
});

export const cryptoToolContextSchema = z.object({
  toolName: z.string().min(1),
  toolArgs: z.unknown(),
});

export const cryptoWorkflowContextSchema = z.object({
  workflowId: z.string().min(1),
  workflowTitle: z.string().min(1),
  workflowStatus: z.string().min(1),
  safety: z.object({
    containsFinancialSteps: z.boolean(),
    requiresTransactionCaps: z.boolean(),
    requiresAuditLog: z.boolean(),
    simulateOnlyByDefault: z.boolean(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    approvalState: z.enum(['not_required', 'required', 'approved', 'rejected']),
    schedulePreference: z.enum([
      'github_actions_when_possible',
      'interactive_runtime_if_stateful',
      'manual_only',
    ]),
  }),
});

export const cryptoGuardrailEvaluationInputSchema = z.object({
  subjectType: cryptoGuardrailSubjectTypeSchema,
  triggerSource: z.enum(['manual', 'api', 'schedule', 'event', 'system', 'chat', 'orchestration']),
  actor: z.object({
    userId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
  }),
  tool: cryptoToolContextSchema.optional(),
  workflow: cryptoWorkflowContextSchema.optional(),
  config: cryptoGuardrailConfigSchema.nullable(),
  destinations: z.array(cryptoDestinationAllowlistEntrySchema).default([]),
});

export const cryptoGuardrailDecisionSchema = z.object({
  subjectType: cryptoGuardrailSubjectTypeSchema,
  cryptoActionType: cryptoGuardrailActionTypeSchema,
  isCryptoRelated: z.boolean(),
  riskLevel: cryptoRiskLevelSchema,
  asset: z.string().min(1).nullable(),
  amount: z.string().min(1).nullable(),
  estimatedUsdCents: z.number().int().nonnegative().nullable(),
  destination: z.string().min(1).nullable(),
  scopes: z.array(z.string()).default([]),
  decision: cryptoGuardrailDecisionTypeSchema,
  reason: z.string().min(1),
  requiresApproval: z.boolean(),
  simulateOnly: z.boolean(),
  capStatus: cryptoCapStatusSchema,
  allowlistStatus: cryptoAllowlistStatusSchema,
  configPresent: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type CryptoGuardrailConfig = z.infer<typeof cryptoGuardrailConfigSchema>;
export type CryptoDestinationAllowlistEntry = z.infer<typeof cryptoDestinationAllowlistEntrySchema>;
export type CryptoGuardrailEvaluationInput = z.infer<typeof cryptoGuardrailEvaluationInputSchema>;
export type CryptoGuardrailDecision = z.infer<typeof cryptoGuardrailDecisionSchema>;
