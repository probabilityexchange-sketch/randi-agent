import { describe, it, expect } from "vitest";
import {
  estimateWorkflowCost,
  estimateWorkflowRunCost,
  getDefaultModelCost,
} from "./estimator";

it("estimates workflow cost with steps", () => {
  const result = estimateWorkflowCost({
    steps: [
      { id: "1", description: "Research task", kind: "research", toolHints: [] },
      { id: "2", description: "Execute action", kind: "action", toolHints: ["TOOL_A"] },
      { id: "3", description: "Send notification", kind: "notify", toolHints: [] },
    ],
  });

  expect(result.totalEstimate > 0).toBeTruthy();
  expect(result.breakdown.length).toBe(3);
  expect(result.isMinimum).toBe(true);
  expect(result.disclaimer.includes("external") || result.disclaimer.includes("minimum")).toBeTruthy();
});

it("estimates workflow cost from plan JSON", () => {
  const planJson = JSON.stringify({
    steps: [
      { id: "1", description: "Research", kind: "research", toolHints: [] },
    ],
  });

  const result = estimateWorkflowRunCost({ workflowPlanJson: planJson });

  expect(result.totalEstimate > 0).toBeTruthy();
  expect(result.breakdown.length).toBe(1);
});

it("handles invalid plan JSON gracefully", () => {
  const result = estimateWorkflowRunCost({ workflowPlanJson: "invalid json" });

  expect(result.totalEstimate > 0).toBeTruthy();
  expect(result.disclaimer.includes("fallback")).toBeTruthy();
});

it("returns default model cost", () => {
  const cost = getDefaultModelCost();
  expect(cost > 0).toBeTruthy();
});

it("estimates different costs for different step kinds", () => {
  const researchResult = estimateWorkflowCost({
    steps: [{ id: "1", description: "Research", kind: "research", toolHints: [] }],
  });

  const notifyResult = estimateWorkflowCost({
    steps: [{ id: "1", description: "Notify", kind: "notify", toolHints: [] }],
  });

  expect(researchResult.totalEstimate).not.toBe(notifyResult.totalEstimate);
});
