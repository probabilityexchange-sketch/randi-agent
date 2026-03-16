import { describe, it, expect } from "vitest";
import { compileWorkflowPlan } from "./compiler";
import {
  canStartWorkflowRun,
  deriveWorkflowSafety,
  deserializeWorkflowPlan,
  deserializeWorkflowRetryHistory,
  determineRunnableStatus,
  evaluateWorkflowRunPolicy,
  serializeWorkflowPlan,
  serializeWorkflowRetryHistory,
} from "./persistence";

it("serializes and restores workflow plans safely", () => {
  const plan = compileWorkflowPlan("Check GitHub issues daily and summarize them in Slack");
  const serialized = serializeWorkflowPlan(plan);
  const restored = deserializeWorkflowPlan(serialized);

  expect(restored).toEqual(plan);
});

it("marks financial workflows as blocked for execution", () => {
  const plan = compileWorkflowPlan("Buy SOL when price drops and send a Telegram update");
  const safety = deriveWorkflowSafety(plan);
  const policyDecision = evaluateWorkflowRunPolicy({
    userId: "user_123",
    workflowId: "wf_financial",
    workflowTitle: plan.title,
    workflowStatus: "draft",
    triggerSource: "manual",
    safety,
    crypto: {
      config: {
        defaultDecision: "simulate",
        perTransactionUsdCapCents: 10_00,
        dailyUsdCapCents: 50_00,
        enforceDestinationAllowlist: true,
        blockScheduledCrypto: true,
      },
      destinations: [],
    },
  });
  const decision = canStartWorkflowRun({ workflowStatus: "draft", safety });

  expect(safety.containsFinancialSteps).toBe(true);
  expect(safety.requiresTransactionCaps).toBe(true);
  expect(safety.simulateOnlyByDefault).toBe(true);
  expect(policyDecision.decision).toBe("simulate");
  expect(decision.allowed).toBe(false);
  expect(decision.status).toBe("blocked");
  expect(decision.blockedReason ?? "").toMatch(/Workflow requires explicit approval/i);
});

it("marks low-risk workflows as ready when no open questions remain", () => {
  const plan = {
    ...compileWorkflowPlan("Summarize yesterday's GitHub issues in Slack"),
    openQuestions: [],
  };
  const safety = deriveWorkflowSafety(plan);
  const status = determineRunnableStatus(plan, safety);
  const decision = canStartWorkflowRun({ workflowStatus: status, safety });

  expect(status).toBe("ready");
  expect(decision.allowed).toBe(true);
  expect(decision.status).toBe("pending");
});

it("round-trips retry history metadata", () => {
  const retryHistory = [
    {
      attempt: 1,
      reason: "Transient network timeout",
      requestedAt: new Date("2026-03-06T00:00:00.000Z").toISOString(),
    },
  ];

  const serialized = serializeWorkflowRetryHistory(retryHistory);
  const restored = deserializeWorkflowRetryHistory(serialized);

  expect(restored).toEqual(retryHistory);
});

it("routes approval-required workflow runs through policy", () => {
  const plan = compileWorkflowPlan("Post a Slack summary after reviewing GitHub issues and wait for approval before sending");
  const safety = deriveWorkflowSafety(plan);
  const decision = evaluateWorkflowRunPolicy({
    userId: "user_123",
    workflowId: "wf_123",
    workflowTitle: plan.title,
    workflowStatus: "draft",
    triggerSource: "manual",
    safety,
  });

  expect(decision.decision).toBe("approve");
  expect(decision.requiresApproval).toBe(true);
});
