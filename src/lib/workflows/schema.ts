import { z } from 'zod';

export const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'schedule', 'event', 'monitor', 'unknown']),
  description: z.string().min(1),
  schedule: z.string().optional(),
  preferredRunner: z.enum(['github_actions', 'interactive_runtime', 'manual', 'unknown']),
});

export const workflowStepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'research',
    'monitor',
    'decision',
    'action',
    'notify',
    'financial',
    'report',
    'unknown',
  ]),
  description: z.string().min(1),
  toolHints: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
});

export const workflowApprovalSchema = z.object({
  type: z.enum(['required', 'recommended']),
  reason: z.string().min(1),
  appliesToStepIds: z.array(z.string()).default([]),
});

export const workflowToolRecommendationSchema = z.object({
  currentApproach: z.string().min(1),
  suggestedApproach: z.string().min(1),
  reason: z.string().min(1),
});

export const workflowGuardrailsSchema = z.object({
  requiresExplicitApproval: z.boolean(),
  requiresTransactionCaps: z.boolean(),
  requiresAuditLog: z.boolean(),
  requiresExplicitScopes: z.boolean(),
  simulateOnlyByDefault: z.boolean(),
  schedulingPreference: z.enum([
    'github_actions_when_possible',
    'interactive_runtime_if_stateful',
    'manual_only',
  ]),
});

export const workflowPlanSchema = z.object({
  version: z.literal('1'),
  status: z.literal('draft'),
  readiness: z.enum(['draft_only', 'needs_policy_confirmation']),
  sourceRequest: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  summary: z.string().min(1),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema).min(1),
  approvals: z.array(workflowApprovalSchema),
  toolRecommendations: z.array(workflowToolRecommendationSchema),
  guardrails: workflowGuardrailsSchema,
  openQuestions: z.array(z.string()),
  riskNotes: z.array(z.string()),
  nextActions: z.array(z.enum(['edit', 'confirm'])).min(1),
});

export const workflowStoredStatusSchema = z.enum(['draft', 'ready', 'archived']);

export const workflowRiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const workflowApprovalStateSchema = z.enum([
  'not_required',
  'required',
  'approved',
  'rejected',
]);

export const workflowRunStatusSchema = z.enum([
  'pending',
  'ready',
  'blocked',
  'running',
  'failed',
  'completed',
  'cancelled',
]);

export const workflowScheduleStatusSchema = z.enum(['draft', 'active', 'paused', 'blocked']);

export const workflowScheduleDeploymentStateSchema = z.enum([
  'pending_manual_sync',
  'synced',
  'needs_resync',
  'blocked',
]);

export const workflowScheduleSecretRequirementSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().default(true),
  valueHint: z.string().optional(),
});

export const workflowScheduleDeploymentBundleSchema = z.object({
  scheduleId: z.string().min(1),
  workflowId: z.string().min(1),
  title: z.string().min(1),
  filename: z.string().min(1),
  filePath: z.string().min(1),
  content: z.string().min(1),
  secrets: z.array(workflowScheduleSecretRequirementSchema),
  envVars: z.record(z.string(), z.string()),
  dispatchUrl: z.string().min(1),
  syncStatus: workflowScheduleDeploymentStateSchema,
  instructions: z.array(z.string()),
});

export const workflowSchedulerTargetSchema = z.enum([
  'github_actions',
  'interactive_runtime',
  'manual_only',
]);

export const workflowScopeModeSchema = z.enum(['read', 'write']);

export const workflowScopeSchema = z.object({
  tool: z.string().min(1),
  mode: workflowScopeModeSchema,
  resources: z.array(z.string()).default([]),
  reason: z.string().min(1),
});

export const workflowSafetyMetadataSchema = z.object({
  containsFinancialSteps: z.boolean(),
  requiresApproval: z.boolean(),
  requiresTransactionCaps: z.boolean(),
  requiresAuditLog: z.boolean(),
  simulateOnlyByDefault: z.boolean(),
  riskLevel: workflowRiskLevelSchema,
  approvalState: workflowApprovalStateSchema,
  explicitScopesRequired: z.boolean(),
  scopes: z.array(workflowScopeSchema),
  schedulePreference: z.enum([
    'github_actions_when_possible',
    'interactive_runtime_if_stateful',
    'manual_only',
  ]),
});

export const workflowRunRetrySchema = z.object({
  attempt: z.number().int().min(1),
  reason: z.string().min(1),
  requestedAt: z.string().datetime(),
});

export const workflowRunErrorSchema = z.object({
  message: z.string().min(1),
  code: z.string().min(1).optional(),
  stepId: z.string().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime(),
});

export const workflowScheduleSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  userId: z.string().min(1),
  status: workflowScheduleStatusSchema,
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  schedulerTarget: workflowSchedulerTargetSchema,
  deploymentState: workflowScheduleDeploymentStateSchema,
  deploymentReason: z.string().nullable(),
  githubWorkflowName: z.string().nullable(),
  githubWorkflowPath: z.string().nullable(),
  githubSecretName: z.string().nullable(),
  lastTriggeredAt: z.string().datetime().nullable(),
  lastSuccessfulAt: z.string().datetime().nullable(),
  lastRunId: z.string().nullable(),
  lastError: z.string().nullable(),
  consecutiveFailures: z.number().int().min(0),
  deploymentBundle: workflowScheduleDeploymentBundleSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const workflowSchedulePreviewSchema = z.object({
  schedulerTarget: workflowSchedulerTargetSchema,
  workflowName: z.string().min(1),
  workflowPath: z.string().min(1),
  secretName: z.string().min(1),
  dispatchPath: z.string().min(1),
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  yaml: z.string().min(1),
});

export const savedWorkflowSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1),
  status: workflowStoredStatusSchema,
  plan: workflowPlanSchema,
  safety: workflowSafetyMetadataSchema,
  schedule: workflowScheduleSchema.nullable().optional(),
  latestRunStatus: workflowRunStatusSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const workflowRunRecordSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  userId: z.string().min(1),
  status: workflowRunStatusSchema,
  attemptNumber: z.number().int().min(1),
  triggerSource: z.enum(['manual', 'api', 'schedule', 'event', 'system']),
  blockedReason: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  lastError: workflowRunErrorSchema.nullable(),
  retryHistory: z.array(workflowRunRetrySchema),
  estimatedTokens: z.number().int().nullable(),
  actualTokens: z.number().int().nullable(),
  costAttributionMethod: z
    .enum(['exact', 'time_window_attributed', 'unavailable'])
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowPlan = z.infer<typeof workflowPlanSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowStoredStatus = z.infer<typeof workflowStoredStatusSchema>;
export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;
export type WorkflowScheduleStatus = z.infer<typeof workflowScheduleStatusSchema>;
export type WorkflowScheduleDeploymentState = z.infer<typeof workflowScheduleDeploymentStateSchema>;
export type WorkflowSchedulerTarget = z.infer<typeof workflowSchedulerTargetSchema>;
export type WorkflowSafetyMetadata = z.infer<typeof workflowSafetyMetadataSchema>;
export type WorkflowScope = z.infer<typeof workflowScopeSchema>;
export type WorkflowRunError = z.infer<typeof workflowRunErrorSchema>;
export type WorkflowRunRetry = z.infer<typeof workflowRunRetrySchema>;
export type WorkflowSchedule = z.infer<typeof workflowScheduleSchema>;
export type WorkflowSchedulePreview = z.infer<typeof workflowSchedulePreviewSchema>;
export type WorkflowScheduleDeploymentBundle = z.infer<
  typeof workflowScheduleDeploymentBundleSchema
>;
export type WorkflowScheduleSecretRequirement = z.infer<
  typeof workflowScheduleSecretRequirementSchema
>;
export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>;
export type WorkflowRunRecord = z.infer<typeof workflowRunRecordSchema>;
