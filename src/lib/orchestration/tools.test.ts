import { describe, it, expect } from "vitest";

import {
  buildSpecialistDelegationPrompt,
  parseSpecialistResponseEnvelope,
  formatSpecialistResponse,
  type DelegateToSpecialistArgs,
  type SpecialistResponseEnvelope,
} from "@/lib/orchestration/tools";

const baseArgs: DelegateToSpecialistArgs = {
  specialistSlug: "research-assistant",
  taskSummary: "Check two market data sources for BTC headline moves",
  subQuery: "Inspect the latest BTC headlines and summarize catalysts from two sources.",
  expectedOutput: {
    format: "structured_findings",
    sections: ["completedWork", "output", "evidence", "blockedBy", "unresolved"],
  },
  scopeNotes: ["Use only the assigned research tools.", "Do not give trading advice."],
  completionCriteria: ["Stop after two sources are checked.", "Report if a source is unavailable."],
};

it("buildSpecialistDelegationPrompt includes bounded contract details", () => {
  const prompt = buildSpecialistDelegationPrompt(baseArgs);

  expect(prompt).toMatch(/Delegated task summary: Check two market data sources/);
  expect(prompt).toMatch(/Expected output format: structured_findings/);
  expect(prompt).toMatch(/Scope notes:/);
  expect(prompt).toMatch(/Completion criteria:/);
  expect(prompt).toMatch(/Return only valid JSON matching this shape:/);
  expect(prompt).toMatch(/Do not simulate tool results/);
});

it("parseSpecialistResponseEnvelope preserves structured completion details", () => {
  const envelope = parseSpecialistResponseEnvelope(
    JSON.stringify({
      status: "partial",
      completedWork: ["Checked CoinMarketCap headlines", "Reviewed one browser snapshot"],
      output: "BTC moved after ETF flow commentary, but the second source timed out.",
      evidence: [
        { kind: "tool_call", detail: "COINMARKETCAP_GET_CRYPTO_NEWS" },
        { kind: "url", detail: "https://example.com/btc-news" },
      ],
      blockedBy: ["Second source returned a timeout"],
      unresolved: ["Need confirmation from another independent source"],
    }),
    baseArgs
  );

  expect(envelope.specialistSlug).toBe("research-assistant");
  expect(envelope.status).toBe("partial");
  expect(envelope.completedWork).toEqual(["Checked CoinMarketCap headlines", "Reviewed one browser snapshot"]);
  expect(envelope.evidence.length).toBe(2);
  expect(envelope.blockedBy).toEqual(["Second source returned a timeout"]);
  expect(envelope.unresolved).toEqual(["Need confirmation from another independent source"]);
});

it("parseSpecialistResponseEnvelope marks unstructured text as unresolved raw handoff", () => {
  const envelope = parseSpecialistResponseEnvelope("Looked around and found some things.", baseArgs);

  expect(envelope.status).toBe("failed");
  expect(envelope.output).toBe("Looked around and found some things.");
  expect(envelope.completedWork).toEqual([]);
  expect(envelope.unresolved[0]).toMatch(/unstructured/i);
});

it("formatSpecialistResponse returns human readable markdown", () => {
  const envelope: SpecialistResponseEnvelope = {
    specialistSlug: "token-launcher",
    status: "completed",
    role: "token launch specialist",
    delegatedTask: "Launch $RANDI token on Base",
    completedWork: ["Validated parameters", "Generated !clawnch post"],
    output: "The token launch post is ready. Please post it to Moltbook.",
    evidence: [],
    blockedBy: [],
    unresolved: [],
  };

  const formatted = formatSpecialistResponse(envelope);

  expect(formatted).toMatch(/✅ \*TOKEN LAUNCH SPECIALIST REPORT\*/);
  expect(formatted).toMatch(/Launch \$RANDI token on Base/);
  expect(formatted).toMatch(/The token launch post is ready/);
  expect(formatted).toMatch(/- Validated parameters/);
  expect(formatted).toMatch(/- Generated !clawnch post/);
});

it("formatSpecialistResponse handles blocked status with emoji", () => {
  const envelope: SpecialistResponseEnvelope = {
    specialistSlug: "research-assistant",
    status: "blocked",
    role: "research specialist",
    delegatedTask: "Find price of $RANDI",
    completedWork: [],
    output: "I could not find the price.",
    evidence: [],
    blockedBy: ["API is down"],
    unresolved: ["Price remains unknown"],
  };

  const formatted = formatSpecialistResponse(envelope);

  expect(formatted).toMatch(/🛑 \*RESEARCH SPECIALIST REPORT\*/);
  expect(formatted).toMatch(/\*Blocked By:\*/);
  expect(formatted).toMatch(/- API is down/);
  expect(formatted).toMatch(/\*Unresolved Issues:\*/);
  expect(formatted).toMatch(/- Price remains unknown/);
});
