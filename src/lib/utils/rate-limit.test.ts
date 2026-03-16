import { describe, it, expect } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests within limit", async () => {
    const result = await checkRateLimit(`test:${Date.now()}:allow`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks requests over limit", async () => {
    const key = `test:${Date.now()}:block`;
    const config = { maxRequests: 2, windowMs: 60 * 1000 };

    const first = await checkRateLimit(key, config);
    expect(first.allowed).toBe(true);

    const second = await checkRateLimit(key, config);
    expect(second.allowed).toBe(true);

    const third = await checkRateLimit(key, config);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("uses independent limits per key", async () => {
    const config = { maxRequests: 1, windowMs: 60 * 1000 };

    const resultA = await checkRateLimit(`test:key-a:${Date.now()}`, config);
    const resultB = await checkRateLimit(`test:key-b:${Date.now()}`, config);

    expect(resultA.allowed).toBe(true);
    expect(resultB.allowed).toBe(true);
  });
});

describe("RATE_LIMITS constants", () => {
  it("defines all expected rate limit tiers", () => {
    expect(RATE_LIMITS.general.maxRequests).toBeGreaterThan(0);
    expect(RATE_LIMITS.purchase.maxRequests).toBeGreaterThan(0);
    expect(RATE_LIMITS.chat.maxRequests).toBeGreaterThan(0);
    expect(RATE_LIMITS.auth.maxRequests).toBeGreaterThan(0);
  });
});
