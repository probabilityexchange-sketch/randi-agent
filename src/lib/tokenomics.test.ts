import { describe, it, expect } from "vitest";
import {
  BURN_BPS,
  TREASURY_BPS,
  AGENT_PRICING,
  getModelTier,
  getCallCost,
  getCreditPacks,
  toLamports,
  fromLamports,
  formatRandi,
  TOKEN_DECIMALS,
} from "@/lib/tokenomics";

describe("Tokenomics Constants", () => {
  it("burn + treasury BPS equals 10000 (100%)", () => {
    expect(BURN_BPS + TREASURY_BPS).toBe(10_000);
  });

  it("burn rate is 70%", () => {
    expect(BURN_BPS).toBe(7_000);
  });

  it("treasury rate is 30%", () => {
    expect(TREASURY_BPS).toBe(3_000);
  });

  it("has three pricing tiers", () => {
    expect(Object.keys(AGENT_PRICING)).toEqual(["STANDARD", "PREMIUM", "ULTRA"]);
  });

  it("pricing tiers are ordered by cost", () => {
    expect(AGENT_PRICING.STANDARD).toBeLessThan(AGENT_PRICING.PREMIUM);
    expect(AGENT_PRICING.PREMIUM).toBeLessThan(AGENT_PRICING.ULTRA);
  });
});

describe("getModelTier", () => {
  it("maps free models to STANDARD", () => {
    expect(getModelTier("llama-3-70b:free")).toBe("STANDARD");
    expect(getModelTier("any-model:free")).toBe("STANDARD");
  });

  it("maps exact model names", () => {
    expect(getModelTier("gpt-4o")).toBe("PREMIUM");
    expect(getModelTier("o1")).toBe("ULTRA");
    expect(getModelTier("claude-3-opus")).toBe("ULTRA");
  });

  it("matches by prefix", () => {
    expect(getModelTier("llama-3-70b-instruct")).toBe("STANDARD");
    expect(getModelTier("deepseek-v2")).toBe("STANDARD");
  });

  it("defaults unknown models to STANDARD", () => {
    expect(getModelTier("unknown-model-xyz")).toBe("STANDARD");
  });
});

describe("getCallCost", () => {
  it("returns correct breakdown for STANDARD tier", () => {
    const cost = getCallCost("llama-3-70b:free");
    expect(cost.tier).toBe("STANDARD");
    expect(cost.finalCost).toBe(AGENT_PRICING.STANDARD);
    expect(cost.burnAmount).toBe(Math.floor((cost.finalCost * BURN_BPS) / 10_000));
    expect(cost.treasuryAmount).toBe(cost.finalCost - cost.burnAmount);
    expect(cost.burnAmount + cost.treasuryAmount).toBe(cost.finalCost);
  });

  it("returns correct breakdown for PREMIUM tier", () => {
    const cost = getCallCost("gpt-4o");
    expect(cost.tier).toBe("PREMIUM");
    expect(cost.finalCost).toBe(AGENT_PRICING.PREMIUM);
    expect(cost.burnAmount + cost.treasuryAmount).toBe(cost.finalCost);
  });

  it("returns correct breakdown for ULTRA tier", () => {
    const cost = getCallCost("claude-3-opus");
    expect(cost.tier).toBe("ULTRA");
    expect(cost.finalCost).toBe(AGENT_PRICING.ULTRA);
    expect(cost.burnAmount + cost.treasuryAmount).toBe(cost.finalCost);
  });

  it("burn amount is always 70% of total cost", () => {
    for (const model of ["llama-3:free", "gpt-4o", "o1"]) {
      const cost = getCallCost(model);
      const expectedBurn = Math.floor((cost.finalCost * 7_000) / 10_000);
      expect(cost.burnAmount).toBe(expectedBurn);
    }
  });
});

describe("toLamports / fromLamports", () => {
  it("converts tokens to lamports", () => {
    expect(toLamports(1)).toBe(BigInt(10 ** TOKEN_DECIMALS));
    expect(toLamports(100)).toBe(BigInt(100 * 10 ** TOKEN_DECIMALS));
  });

  it("converts lamports back to tokens", () => {
    expect(fromLamports(BigInt(1_000_000))).toBe(1);
    expect(fromLamports(BigInt(100_000_000))).toBe(100);
  });

  it("round-trips correctly", () => {
    expect(fromLamports(toLamports(42))).toBe(42);
  });
});

describe("formatRandi", () => {
  it("formats token amounts with commas", () => {
    expect(formatRandi(1000)).toBe("1,000 $RANDI");
    expect(formatRandi(1_000_000)).toBe("1,000,000 $RANDI");
  });
});

describe("getCreditPacks", () => {
  it("returns at least 3 packs", () => {
    const packs = getCreditPacks();
    expect(packs.length).toBeGreaterThanOrEqual(3);
  });

  it("all packs have positive credit amounts and prices", () => {
    for (const pack of getCreditPacks()) {
      expect(pack.creditAmount).toBeGreaterThan(0);
      expect(pack.usdPrice).toBeGreaterThan(0);
    }
  });

  it("packs have unique IDs", () => {
    const packs = getCreditPacks();
    const ids = packs.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("bonus packs give more credits per dollar", () => {
    const packs = getCreditPacks().filter((p) => p.type === "payg");
    for (let i = 1; i < packs.length; i++) {
      const prevRatio = packs[i - 1].creditAmount / packs[i - 1].usdPrice;
      const currRatio = packs[i].creditAmount / packs[i].usdPrice;
      expect(currRatio).toBeGreaterThanOrEqual(prevRatio);
    }
  });
});
