import { describe, it, expect } from "vitest";
import {
  splitTokenAmountsByBurn,
  parseBurnBpsFromMemo,
  resolvePaymentAsset,
  resolveSolBurnWallet,
} from "@/lib/payments/token-pricing";
import { BURN_BPS } from "@/lib/tokenomics";

describe("splitTokenAmountsByBurn", () => {
  it("uses BURN_BPS from tokenomics by default", () => {
    const result = splitTokenAmountsByBurn(BigInt(10_000));
    expect(result.burnBps).toBe(BURN_BPS);
    expect(result.burnBps).toBe(7_000);
  });

  it("splits correctly at 70/30", () => {
    const result = splitTokenAmountsByBurn(BigInt(10_000));
    expect(result.burnTokenAmount).toBe(BigInt(7_000));
    expect(result.treasuryTokenAmount).toBe(BigInt(3_000));
  });

  it("burn + treasury equals input", () => {
    const gross = BigInt(123_456);
    const result = splitTokenAmountsByBurn(gross);
    expect(result.burnTokenAmount + result.treasuryTokenAmount).toBe(gross);
  });

  it("handles zero amount", () => {
    const result = splitTokenAmountsByBurn(BigInt(0));
    expect(result.burnTokenAmount).toBe(BigInt(0));
    expect(result.treasuryTokenAmount).toBe(BigInt(0));
  });

  it("accepts custom burn BPS override", () => {
    const result = splitTokenAmountsByBurn(BigInt(10_000), 5_000);
    expect(result.burnBps).toBe(5_000);
    expect(result.burnTokenAmount).toBe(BigInt(5_000));
    expect(result.treasuryTokenAmount).toBe(BigInt(5_000));
  });
});

describe("parseBurnBpsFromMemo", () => {
  it("extracts burn BPS from memo suffix", () => {
    expect(parseBurnBpsFromMemo("randi:purchase:b7000")).toBe(7_000);
    expect(parseBurnBpsFromMemo("randi:purchase:b1000")).toBe(1_000);
  });

  it("returns 0 for memos without burn suffix", () => {
    expect(parseBurnBpsFromMemo("randi:purchase")).toBe(0);
    expect(parseBurnBpsFromMemo("")).toBe(0);
  });

  it("caps at 10000 BPS", () => {
    expect(parseBurnBpsFromMemo("randi:purchase:b99999")).toBe(10_000);
  });

  it("handles edge cases", () => {
    expect(parseBurnBpsFromMemo("randi:purchase:b0")).toBe(0);
    expect(parseBurnBpsFromMemo("randi:purchase:b10000")).toBe(10_000);
  });
});

describe("resolvePaymentAsset", () => {
  it("defaults to spl", () => {
    const original = process.env.PAYMENT_ASSET;
    delete process.env.PAYMENT_ASSET;
    expect(resolvePaymentAsset()).toBe("spl");
    if (original !== undefined) process.env.PAYMENT_ASSET = original;
  });
});

describe("resolveSolBurnWallet", () => {
  it("returns default burn wallet when not configured", () => {
    const original = process.env.SOL_BURN_WALLET;
    delete process.env.SOL_BURN_WALLET;
    const wallet = resolveSolBurnWallet();
    expect(wallet).toBe("1nc1nerator11111111111111111111111111111111");
    if (original !== undefined) process.env.SOL_BURN_WALLET = original;
  });
});
