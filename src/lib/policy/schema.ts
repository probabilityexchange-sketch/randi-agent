import { z } from 'zod';
import {
  cryptoDestinationAllowlistEntrySchema,
  cryptoGuardrailConfigSchema,
  cryptoGuardrailDecisionSchema,
} from '@/lib/crypto/schema';

export const policyDecisionTypeSchema = z.enum(['allow', 'approve', 'deny', 'simulate']);

export const policyRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const policySubjectTypeSchema = z.enum(['tool_call', 'workflow_run']);

export const policyActionTypeSchema = z.enum([
  'read',
  'write',
  'dangerous',
  'financial',
  'payment',
  'trading',
  'workflow_execute',
]);

export const policyScopeModeSchema = z.enum(['read', 'write']);

export const policyScopeSchema = z.object({
  tool: z.string().min(1),
  mode: policyScopeModeSchema,
  resources: z.array(z.string()).default([]),
  reason: z.string().min(1),
});

export const policyTriggerSourceSchema = z.enum([
  'manual',
  'api',
  'schedule',
  'event',
  'system',
  'chat',
  'orchestration',
]);

export const policyActorSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});

export const toolPolicyInputSchema = z.object({
  subjectType: z.literal('tool_call'),
  actor: policyActorSchema,
  triggerSource: policyTriggerSourceSchema.default('chat'),
  toolName: z.string().min(1),
  toolArgs: z.unknown(),
  scopes: z.array(policyScopeSchema).default([]),
  crypto: z
    .object({
      config: cryptoGuardrailConfigSchema.nullable(),
      destinations: z.array(cryptoDestinationAllowlistEntrySchema).default([]),
    })
    .optional(),
});

export const workflowRunPolicyInputSchema = z.object({
  subjectType: z.literal('workflow_run'),
  actor: policyActorSchema,
  triggerSource: policyTriggerSourceSchema,
  workflowId: z.string().min(1),
  workflowTitle: z.string().min(1),
  workflowStatus: z.string().min(1),
  safety: z.object({
    containsFinancialSteps: z.boolean(),
    requiresApproval: z.boolean(),
    requiresTransactionCaps: z.boolean(),
    requiresAuditLog: z.boolean(),
    simulateOnlyByDefault: z.boolean(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    approvalState: z.enum(['not_required', 'required', 'approved', 'rejected']),
    explicitScopesRequired: z.boolean(),
    scopes: z.array(policyScopeSchema),
    schedulePreference: z.enum([
      'github_actions_when_possible',
      'interactive_runtime_if_stateful',
      'manual_only',
    ]),
  }),
  crypto: z
    .object({
      config: cryptoGuardrailConfigSchema.nullable(),
      destinations: z.array(cryptoDestinationAllowlistEntrySchema).default([]),
    })
    .optional(),
});

export const policyInputSchema = z.union([toolPolicyInputSchema, workflowRunPolicyInputSchema]);

export const policyDecisionSchema = z.object({
  subjectType: policySubjectTypeSchema,
  actionType: policyActionTypeSchema,
  riskLevel: policyRiskLevelSchema,
  scopes: z.array(policyScopeSchema),
  decision: policyDecisionTypeSchema,
  reason: z.string().min(1),
  requiresApproval: z.boolean(),
  simulateOnly: z.boolean(),
  auditRequired: z.boolean(),
  approvalRequestRequired: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  crypto: cryptoGuardrailDecisionSchema.nullable().optional(),
});

export type PolicyDecisionType = z.infer<typeof policyDecisionTypeSchema>;
export type PolicyRiskLevel = z.infer<typeof policyRiskLevelSchema>;
export type PolicyScope = z.infer<typeof policyScopeSchema>;
export type ToolPolicyInput = z.infer<typeof toolPolicyInputSchema>;
export type WorkflowRunPolicyInput = z.infer<typeof workflowRunPolicyInputSchema>;
export type PolicyInput = z.infer<typeof policyInputSchema>;
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
