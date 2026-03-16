import { describe, it, expect } from "vitest";
import { buildWorkflowScheduleDeploymentBundle } from "@/lib/workflows/scheduling";

it("builds a complete deployment bundle for github actions", () => {
  const bundle = buildWorkflowScheduleDeploymentBundle({
    scheduleId: "sched_123",
    workflowId: "wf_123",
    title: "Test Workflow",
    cronExpression: "0 * * * *",
    timezone: "UTC",
    deploymentState: "pending_manual_sync",
    baseUrl: "https://api.test.com",
  });

  expect(bundle.scheduleId).toBe("sched_123");
  expect(bundle.workflowId).toBe("wf_123");
  expect(bundle.title).toBe("Test Workflow");
  expect(bundle.filename).toBe("scheduled-workflow-wf_123.yml");
  expect(bundle.content).toMatch(/X-Workflow-Schedule-Token/);
  expect(bundle.content).toMatch(/https:\/\/api\.test\.com/);

  // Secrets
  const secretNames = bundle.secrets.map(s => s.name);
  expect(secretNames.includes("WORKFLOW_SCHEDULE_TOKEN_SCHED_123")).toBeTruthy();
  expect(secretNames.includes("APP_BASE_URL")).toBeTruthy();

  // Instructions
  expect(bundle.instructions.length >= 5).toBeTruthy();
  expect(bundle.instructions.some(i => i.includes(".github/workflows/scheduled-workflow-wf_123.yml"))).toBeTruthy();
});

it("adds resync notice to instructions when state is needs_resync", () => {
  const bundle = buildWorkflowScheduleDeploymentBundle({
    scheduleId: "sched_123",
    workflowId: "wf_123",
    title: "Test Workflow",
    cronExpression: "0 * * * *",
    timezone: "UTC",
    deploymentState: "needs_resync",
  });

  expect(bundle.syncStatus).toBe("needs_resync");
  expect(bundle.instructions.some(i => i.includes("NOTE: This workflow has changed"))).toBeTruthy();
});

it("builds bundle for blocked state", () => {
  const bundle = buildWorkflowScheduleDeploymentBundle({
    scheduleId: "sched_123",
    workflowId: "wf_123",
    title: "Test Workflow",
    cronExpression: "0 * * * *",
    timezone: "UTC",
    deploymentState: "blocked",
  });

  expect(bundle.syncStatus).toBe("blocked");
  expect(bundle.instructions.length >= 5).toBeTruthy();
});
