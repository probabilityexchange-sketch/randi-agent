import { describe, it, expect } from "vitest";
import { compileWorkflowPlan, looksLikeWorkflowRequest } from "./compiler";
import { buildToolRecommendationsFromHeuristics } from "./tool-recommendations";

it("detects recurring monitoring requests as workflow intent", () => {
  expect(
    looksLikeWorkflowRequest("Monitor pump.fun opportunities every hour and alert me in Telegram"),
  ).toBe(true);
});

it("compiles a scheduled monitoring workflow with GitHub Actions preference", () => {
  const plan = compileWorkflowPlan("Monitor pump.fun opportunities every hour and alert me in Telegram");

  expect(plan.trigger.type).toBe("schedule");
  expect(plan.trigger.preferredRunner).toBe("github_actions");
  expect(plan.trigger.schedule ?? "").toMatch(/every hour/i);
  expect(plan.steps.length >= 1).toBeTruthy();
  expect(plan.toolRecommendations.some((item) => item.suggestedApproach === "GitHub Actions")).toBeTruthy();
});

it("marks financial workflows as needing policy confirmation", () => {
  const plan = compileWorkflowPlan("When a token breaks out, buy it and send the fill summary to Telegram");

  expect(plan.readiness).toBe("needs_policy_confirmation");
  expect(plan.guardrails.requiresTransactionCaps).toBe(true);
  expect(plan.guardrails.simulateOnlyByDefault).toBe(true);
  expect(plan.approvals.some((approval) => approval.reason.toLowerCase().includes("financial"))).toBeTruthy();
});

it("recommends GitHub Actions instead of cron jobs", () => {
  const plan = compileWorkflowPlan("Replace my cron job with a workflow that checks new GitHub issues daily and posts a summary");

  expect(plan.toolRecommendations.some((item) => item.currentApproach.includes("Cron") || item.currentApproach.includes("scheduled"))).toBeTruthy();
  expect(plan.toolRecommendations.some((item) => item.suggestedApproach === "GitHub Actions")).toBeTruthy();
});

it("builds GitHub integration recommendation for manual repo checking", () => {
  const recommendations = buildToolRecommendationsFromHeuristics(
    "Check GitHub issues manually and review pull request status for my repo",
    {
      type: "manual",
      description: "Manual trigger",
      preferredRunner: "manual",
    },
  );

  expect(recommendations.some((item) => item.suggestedApproach === "GitHub integration")).toBeTruthy();
  expect(recommendations.some((item) => item.reason.includes("structured repository state"))).toBeTruthy();
});

it("builds CoinMarketCap recommendation for generic crypto lookups", () => {
  const recommendations = buildToolRecommendationsFromHeuristics(
    "Check the latest crypto prices and market cap rankings for major tokens",
    {
      type: "manual",
      description: "Manual trigger",
      preferredRunner: "manual",
    },
  );

  expect(recommendations.some((item) => item.suggestedApproach === "CoinMarketCap")).toBeTruthy();
  expect(recommendations.some((item) => item.reason.includes("structured crypto prices"))).toBeTruthy();
});

it("compiler includes multiple truthful substitution patterns when applicable", () => {
  const plan = compileWorkflowPlan(
    "Every day, check GitHub issues manually for my repo and compare that with the latest crypto prices before sending a summary",
  );

  expect(plan.toolRecommendations.some((item) => item.suggestedApproach === "GitHub Actions")).toBeTruthy();
  expect(plan.toolRecommendations.some((item) => item.suggestedApproach === "GitHub integration")).toBeTruthy();
  expect(plan.toolRecommendations.some((item) => item.suggestedApproach === "CoinMarketCap")).toBeTruthy();
});
