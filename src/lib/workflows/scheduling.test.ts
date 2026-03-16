import { describe, it, expect } from "vitest";
import { compileWorkflowPlan } from "@/lib/workflows/compiler";
import {
  buildGitHubActionsSchedulePreview,
  buildWorkflowScheduleSecretName,
  getScheduleActivationOutcome,
  getWorkflowSchedulerTarget,
  hashWorkflowScheduleToken,
  isValidCronExpression,
} from "@/lib/workflows/scheduling";

it("validates basic cron expressions conservatively", () => {
  expect(isValidCronExpression("0 * * * *")).toBe(true);
  expect(isValidCronExpression("0 * * *")).toBe(false);
});

it("prefers github actions for scheduled workflow plans", () => {
  const plan = compileWorkflowPlan("Monitor GitHub issues every hour and alert me in Slack");
  expect(getWorkflowSchedulerTarget(plan)).toBe("github_actions");
});

it("blocks schedule activation when policy does not allow scheduled runs", () => {
  const plan = compileWorkflowPlan("Buy SOL every day and notify me");
  const safety = {
    containsFinancialSteps: true,
    requiresApproval: true,
    requiresTransactionCaps: true,
    requiresAuditLog: true,
    simulateOnlyByDefault: true,
    riskLevel: "high" as const,
    approvalState: "required" as const,
    explicitScopesRequired: true,
    scopes: [{ tool: "unassigned", mode: "write" as const, resources: [], reason: "financial" }],
    schedulePreference: "manual_only" as const,
  };

  const outcome = getScheduleActivationOutcome({
    workflowStatus: "draft",
    plan,
    safety,
    policyDecision: {
      subjectType: "workflow_run",
      actionType: "financial",
      riskLevel: "critical",
      scopes: [],
      decision: "deny",
      reason: "Scheduled crypto actions remain blocked.",
      requiresApproval: true,
      simulateOnly: false,
      auditRequired: true,
      approvalRequestRequired: false,
      metadata: {},
      crypto: null,
    },
  });

  expect(outcome.status).toBe("blocked");
  expect(outcome.reason ?? "").toMatch(/ready|blocked|manual/i);
});

it("builds a github actions preview with per-schedule secret metadata", () => {
  const preview = buildGitHubActionsSchedulePreview({
    scheduleId: "sched_123",
    workflowId: "wf_123",
    title: "Issue Monitor",
    cronExpression: "0 * * * *",
    timezone: "UTC",
  });

  expect(preview.secretName).toBe(buildWorkflowScheduleSecretName("sched_123"));
  expect(preview.yaml).toMatch(/X-Workflow-Schedule-Token/);
  expect(preview.workflowPath).toMatch(/scheduled-workflow-wf_123\.yml/);
});

it("hashes schedule tokens deterministically", () => {
  expect(hashWorkflowScheduleToken("abc")).toBe(hashWorkflowScheduleToken("abc"));
});
