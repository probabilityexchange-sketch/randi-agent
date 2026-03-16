import { describe, it, expect } from "vitest";
import { deriveWorkflowSafety } from "@/lib/workflows/persistence";
import { evaluatePolicy } from "@/lib/policy/engine";
import { getScheduleActivationOutcome } from "@/lib/workflows/scheduling";
import { type WorkflowPlan } from "@/lib/workflows/schema";

const mockWorkflowPlan = (overrides: Partial<WorkflowPlan>): WorkflowPlan => ({
  version: "1",
  status: "draft",
  readiness: "needs_policy_confirmation",
  sourceRequest: "Mock",
  title: "Mock Workflow",
  objective: "Mock",
  summary: "Mock",
  trigger: {
    type: "manual",
    description: "Manual trigger",
    preferredRunner: "github_actions",
  },
  steps: [
    {
      id: "step_1",
      kind: "research",
      description: "Research something",
      toolHints: [],
      requiresApproval: false,
    },
  ],
  approvals: [],
  toolRecommendations: [],
  guardrails: {
    requiresExplicitApproval: false,
    requiresTransactionCaps: false,
    requiresAuditLog: false,
    requiresExplicitScopes: false,
    simulateOnlyByDefault: false,
    schedulingPreference: "github_actions_when_possible",
  },
  openQuestions: [],
  riskNotes: [],
  nextActions: ["confirm"],
  ...overrides,
});

it("deriveWorkflowSafety identifies crypto tools in toolHints as financial", () => {
  const plan = mockWorkflowPlan({
    steps: [
      {
        id: "step_1",
        kind: "action",
        description: "Send SOL",
        toolHints: ["SOLANA_TRANSFER_SOL"],
        requiresApproval: false,
      },
    ],
  });

  const safety = deriveWorkflowSafety(plan);
  expect(safety.containsFinancialSteps).toBe(true);
  expect(safety.riskLevel).toBe("high");
});

it("deriveWorkflowSafety distinguishes between read and write crypto tools", () => {
  const planRead = mockWorkflowPlan({
    steps: [
      {
        id: "step_1",
        kind: "action",
        description: "Check balance",
        toolHints: ["SOLANA_GET_BALANCE"],
        requiresApproval: false,
      },
    ],
  });

  const safetyRead = deriveWorkflowSafety(planRead);
  expect(safetyRead.containsFinancialSteps).toBe(false);

  const planWrite = mockWorkflowPlan({
    steps: [
      {
        id: "step_1",
        kind: "action",
        description: "Swap token",
        toolHints: ["JUPITER_SWAP"],
        requiresApproval: false,
      },
    ],
  });

  const safetyWrite = deriveWorkflowSafety(planWrite);
  expect(safetyWrite.containsFinancialSteps).toBe(true);
});

it("getScheduleActivationOutcome blocks activation for financial workflows", () => {
  const plan = mockWorkflowPlan({
    steps: [
      {
        id: "step_1",
        kind: "financial",
        description: "Send token",
        toolHints: ["WALLET_SEND_TOKEN"],
        requiresApproval: true,
      },
    ],
  });

  const safety = deriveWorkflowSafety(plan);

  // Evaluate policy for schedule
  const policyDecision = evaluatePolicy({
    subjectType: "workflow_run",
    actor: { userId: "user_123" },
    triggerSource: "schedule",
    workflowId: "wf_123",
    workflowTitle: "Trade",
    workflowStatus: "ready",
    safety,
    crypto: {
      config: {
        defaultDecision: "deny",
        perTransactionUsdCapCents: 1000,
        dailyUsdCapCents: 5000,
        enforceDestinationAllowlist: true,
        blockScheduledCrypto: true,
      },
      destinations: [],
    },
  });

  expect(policyDecision.decision).toBe("deny");

  const outcome = getScheduleActivationOutcome({
    workflowStatus: "ready",
    plan,
    safety,
    policyDecision,
  });

  expect(outcome.status).toBe("blocked");
  expect(outcome.reason ?? "").toMatch(/remain blocked/i);
});

it("evaluatePolicy blocks scheduled financial workflows even if metadata is inconsistent", () => {
  const safety = {
    containsFinancialSteps: false, // INCONSISTENT METADATA - this is the blind spot
    requiresApproval: false,
    requiresTransactionCaps: false,
    requiresAuditLog: false,
    simulateOnlyByDefault: false,
    riskLevel: "low" as const,
    approvalState: "not_required" as const,
    explicitScopesRequired: false,
    scopes: [{ tool: "SOLANA_TRANSFER_SOL", mode: "write" as const, resources: [], reason: "transfer" }], // SCOPE HAS FINANCIAL TOOL
    schedulePreference: "github_actions_when_possible" as const,
  };

  const decision = evaluatePolicy({
    subjectType: "workflow_run",
    actor: { userId: "user_123" },
    triggerSource: "schedule",
    workflowId: "wf_123",
    workflowTitle: "Trade",
    workflowStatus: "ready",
    safety,
    crypto: {
      config: {
        defaultDecision: "deny",
        perTransactionUsdCapCents: 1000,
        dailyUsdCapCents: 5000,
        enforceDestinationAllowlist: true,
        blockScheduledCrypto: true,
      },
      destinations: [],
    },
  });

  // AFTER FIX: This should now be "deny" because evaluatePolicy checks the scopes
  expect(decision.decision).toBe("deny");
  expect(decision.reason).toMatch(/remain blocked/i);
});
