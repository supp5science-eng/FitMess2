import { describe, expect, it } from "vitest";
import { seedPool } from "../amm";
import { executeBuy, executeSell } from "../trade";

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

describe("executeBuy", () => {
  it("takes the fee off the top and buys with the rest", () => {
    const r = executeBuy(seedPool(1000, 0.5), "yes", 100, 0.01);
    expect(close(r.fee, 1)).toBe(true);
    expect(r.spent).toBe(100);
    // 99 goes into the pool: fewer shares than a fee-free 100 would buy.
    expect(r.shares).toBeLessThan(190.9);
    expect(r.shares).toBeGreaterThan(188);
    expect(close(r.avgPrice, 100 / r.shares)).toBe(true);
  });

  it("a zero fee is the raw AMM", () => {
    const r = executeBuy(seedPool(1000, 0.5), "yes", 100, 0);
    expect(r.fee).toBe(0);
    expect(close(r.shares, 190.909, 1e-2)).toBe(true);
  });

  it("rejects an impossible fee", () => {
    expect(() => executeBuy(seedPool(1000, 0.5), "yes", 100, 1)).toThrow();
    expect(() => executeBuy(seedPool(1000, 0.5), "yes", 100, -0.1)).toThrow();
  });
});

describe("executeSell", () => {
  it("fee comes out of the proceeds", () => {
    const b = executeBuy(seedPool(1000, 0.5), "yes", 100, 0);
    const s = executeSell(b.pool, "yes", b.shares, 0.01);
    expect(close(s.received + s.fee, 100)).toBe(true);
    expect(close(s.fee, 1)).toBe(true);
  });

  it("a buy-sell round trip with fees loses exactly the two fees", () => {
    const b = executeBuy(seedPool(1000, 0.5), "no", 500, 0.01);
    const s = executeSell(b.pool, "no", b.shares, 0.01);
    const lost = b.spent - s.received;
    expect(close(lost, b.fee + s.fee, 1e-6)).toBe(true);
  });
});
