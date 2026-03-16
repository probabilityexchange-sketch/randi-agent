import { describe, it, expect } from "vitest";
import { evaluateCryptoGuardrails } from "@/lib/crypto/guardrails";

const cryptoConfig = {
  defaultDecision: "simulate" as const,
  perTransactionUsdCapCents: 10_00,
  dailyUsdCapCents: 50_00,
  enforceDestinationAllowlist: true,
  blockScheduledCrypto: true,
};

it("allows read-only crypto actions", () => {
  const decision = evaluateCryptoGuardrails({
    subjectType: "tool_call",
    triggerSource: "chat",
    actor: { userId: "user_123" },
    tool: {
      toolName: "WALLET_GET_BALANCE",
      toolArgs: { walletAddress: "0xabc" },
    },
    config: cryptoConfig,
    destinations: [],
  });

  expect(decision.decision).toBe("allow");
  expect(decision.simulateOnly).toBe(false);
  expect(decision.requiresApproval).toBe(false);
});

it("requires approval for within-cap allowlisted crypto writes", () => {
  const decision = evaluateCryptoGuardrails({
    subjectType: "tool_call",
    triggerSource: "chat",
    actor: { userId: "user_123" },
    tool: {
      toolName: "WALLET_SEND_TOKEN",
      toolArgs: {
        amount: "5",
        estimatedUsd: 5,
        asset: "USDC",
        destinationAddress: "0xallow",
      },
    },
    config: cryptoConfig,
    destinations: [{ destination: "0xallow", asset: "USDC", active: true }],
  });

  expect(decision.decision).toBe("approve");
  expect(decision.capStatus).toBe("within_cap");
  expect(decision.allowlistStatus).toBe("allowlisted");
});

it("denies over-cap crypto writes", () => {
  const decision = evaluateCryptoGuardrails({
    subjectType: "tool_call",
    triggerSource: "chat",
    actor: { userId: "user_123" },
    tool: {
      toolName: "WALLET_SEND_TOKEN",
      toolArgs: {
        amount: "25",
        estimatedUsd: 25,
        asset: "USDC",
        destinationAddress: "0xallow",
      },
    },
    config: cryptoConfig,
    destinations: [{ destination: "0xallow", asset: "USDC", active: true }],
  });

  expect(decision.decision).toBe("deny");
  expect(decision.capStatus).toBe("over_cap");
});

it("simulates crypto writes when amount is missing", () => {
  const decision = evaluateCryptoGuardrails({
    subjectType: "tool_call",
    triggerSource: "chat",
    actor: { userId: "user_123" },
    tool: {
      toolName: "TRADING_CREATE_ORDER",
      toolArgs: {
        symbol: "SOL",
        destinationAddress: "exchange-account",
      },
    },
    config: cryptoConfig,
    destinations: [{ destination: "exchange-account", active: true }],
  });

  expect(decision.decision).toBe("simulate");
  expect(decision.simulateOnly).toBe(true);
  expect(decision.capStatus).toBe("missing_amount");
});

it("denies scheduled crypto writes even when capped and allowlisted", () => {
  const decision = evaluateCryptoGuardrails({
    subjectType: "tool_call",
    triggerSource: "schedule",
    actor: { userId: "user_123" },
    tool: {
      toolName: "WALLET_SEND_TOKEN",
      toolArgs: {
        amount: "5",
        estimatedUsd: 5,
        asset: "USDC",
        destinationAddress: "0xallow",
      },
    },
    config: cryptoConfig,
    destinations: [{ destination: "0xallow", asset: "USDC", active: true }],
  });

  expect(decision.decision).toBe("deny");
});
