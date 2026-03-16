import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "@/lib/policy/engine";

const cryptoContext = {
  config: {
    defaultDecision: "simulate" as const,
    perTransactionUsdCapCents: 10_00,
    dailyUsdCapCents: 50_00,
    enforceDestinationAllowlist: true,
    blockScheduledCrypto: true,
  },
  destinations: [{ destination: "0xallow", asset: "USDC", active: true }],
};

describe("Policy Engine - Tool Call Evaluation", () => {
  it("allows low-risk read-only tool actions", () => {
    const decision = evaluatePolicy({
      subjectType: "tool_call",
      actor: { userId: "user_123" },
      triggerSource: "chat",
      toolName: "GITHUB_LIST_REPOSITORY_ISSUES",
      toolArgs: { owner: "acme", repo: "platform" },
      scopes: [{ tool: "GITHUB_LIST_REPOSITORY_ISSUES", mode: "read", resources: ["repo:acme/platform"], reason: "Read repo issues" }],
    });

    expect(decision.decision).toBe("allow");
    expect(decision.requiresApproval).toBe(false);
    expect(decision.simulateOnly).toBe(false);
  });

  it("requires approval for external write tool actions", () => {
    const decision = evaluatePolicy({
      subjectType: "tool_call",
      actor: { userId: "user_123" },
      triggerSource: "chat",
      toolName: "GMAIL_SEND_EMAIL",
      toolArgs: { to: "user@example.com" },
      scopes: [{ tool: "GMAIL_SEND_EMAIL", mode: "write", resources: ["mailbox:primary"], reason: "Send email" }],
    });

    expect(decision.decision).toBe("approve");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.approvalRequestRequired).toBe(true);
  });

  it("handles crypto tool actions with allowlisted destination", () => {
    const decision = evaluatePolicy({
      subjectType: "tool_call",
      actor: { userId: "user_123" },
      triggerSource: "chat",
      toolName: "WALLET_SEND_TOKEN",
      toolArgs: { amount: 5, estimatedUsd: 5, asset: "USDC", destinationAddress: "0xallow" },
      scopes: [{ tool: "WALLET_SEND_TOKEN", mode: "write", resources: ["wallet"], reason: "Send token" }],
      crypto: cryptoContext,
    });

    expect(decision.decision).toBe("approve");
    expect(decision.simulateOnly).toBe(false);
    expect(decision.auditRequired).toBe(true);
    expect(decision.crypto?.allowlistStatus).toBe("allowlisted");
  });

  it("denies over-cap crypto tool actions", () => {
    const decision = evaluatePolicy({
      subjectType: "tool_call",
      actor: { userId: "user_123" },
      triggerSource: "chat",
      toolName: "WALLET_SEND_TOKEN",
      toolArgs: { amount: 25, estimatedUsd: 25, asset: "USDC", destinationAddress: "0xallow" },
      scopes: [{ tool: "WALLET_SEND_TOKEN", mode: "write", resources: ["wallet"], reason: "Transfer funds" }],
      crypto: cryptoContext,
    });

    expect(decision.decision).toBe("deny");
    expect(decision.crypto?.capStatus).toBe("over_cap");
  });

  it("defaults unknown tools to approval-required", () => {
    const decision = evaluatePolicy({
      subjectType: "tool_call",
      actor: { userId: "user_123" },
      triggerSource: "chat",
      toolName: "UNKNOWN_TOOL_ACTION",
      toolArgs: {},
      scopes: [],
    });

    expect(decision.decision).toBe("approve");
    expect(decision.requiresApproval).toBe(true);
    expect(decision.actionType).toBe("dangerous");
  });
});

describe("Policy Engine - Workflow Run Evaluation", () => {
  it("requires approval for workflows with required approval state", () => {
    const decision = evaluatePolicy({
      subjectType: "workflow_run",
      actor: { userId: "user_123" },
      triggerSource: "manual",
      workflowId: "wf_123",
      workflowTitle: "GitHub summary",
      workflowStatus: "draft",
      safety: {
        containsFinancialSteps: false,
        requiresApproval: true,
        requiresTransactionCaps: false,
        requiresAuditLog: false,
        simulateOnlyByDefault: false,
        riskLevel: "medium",
        approvalState: "required",
        explicitScopesRequired: true,
        scopes: [{ tool: "GITHUB_LIST_REPOSITORY_ISSUES", mode: "read", resources: [], reason: "Read issues" }],
        schedulePreference: "github_actions_when_possible",
      },
    });

    expect(decision.decision).toBe("approve");
    expect(decision.requiresApproval).toBe(true);
  });

  it("forces financial workflows into simulate-only mode", () => {
    const decision = evaluatePolicy({
      subjectType: "workflow_run",
      actor: { userId: "user_123" },
      triggerSource: "manual",
      workflowId: "wf_financial",
      workflowTitle: "Trade token",
      workflowStatus: "draft",
      safety: {
        containsFinancialSteps: true,
        requiresApproval: true,
        requiresTransactionCaps: true,
        requiresAuditLog: true,
        simulateOnlyByDefault: true,
        riskLevel: "high",
        approvalState: "required",
        explicitScopesRequired: true,
        scopes: [{ tool: "unassigned", mode: "write", resources: [], reason: "Financial step" }],
        schedulePreference: "manual_only",
      },
      crypto: cryptoContext,
    });

    expect(decision.decision).toBe("simulate");
    expect(decision.simulateOnly).toBe(true);
    expect(decision.auditRequired).toBe(true);
  });

  it("allows non-financial workflows without approval when not required", () => {
    const decision = evaluatePolicy({
      subjectType: "workflow_run",
      actor: { userId: "user_123" },
      triggerSource: "manual",
      workflowId: "wf_safe",
      workflowTitle: "Daily summary",
      workflowStatus: "draft",
      safety: {
        containsFinancialSteps: false,
        requiresApproval: false,
        requiresTransactionCaps: false,
        requiresAuditLog: false,
        simulateOnlyByDefault: false,
        riskLevel: "low",
        approvalState: "not_required",
        explicitScopesRequired: false,
        scopes: [{ tool: "GITHUB_LIST_REPOSITORY_ISSUES", mode: "read", resources: [], reason: "Read issues" }],
        schedulePreference: "github_actions_when_possible",
      },
    });

    expect(decision.decision).toBe("allow");
    expect(decision.requiresApproval).toBe(false);
  });
});
