import { describe, expect, it } from "vitest";
import {
  buy,
  costToBuyShares,
  invariant,
  price,
  probability,
  seedPool,
  sell,
  type Pool,
} from "../amm";

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

describe("seedPool", () => {
  it("opens at exactly the requested probability", () => {
    for (const p of [0.05, 0.3, 0.5, 0.8, 0.95]) {
      expect(close(probability(seedPool(1000, p)), p)).toBe(true);
    }
  });

  it("rejects an empty seed or a probability at the edges", () => {
    expect(() => seedPool(0, 0.5)).toThrow();
    expect(() => seedPool(1000, 0)).toThrow();
    expect(() => seedPool(1000, 1)).toThrow();
  });
});

describe("buy", () => {
  it("preserves the invariant", () => {
    const pool = seedPool(1000, 0.5);
    const k = invariant(pool);
    const q = buy(pool, "yes", 100);
    expect(close(invariant(q.pool), k, 1e-6)).toBe(true);
  });

  it("preserves the invariant at a skewed p too", () => {
    const pool = seedPool(500, 0.2);
    const k = invariant(pool);
    expect(close(invariant(buy(pool, "yes", 300).pool), k, 1e-6)).toBe(true);
    expect(close(invariant(buy(pool, "no", 300).pool), k, 1e-6)).toBe(true);
  });

  it("buying YES raises the probability, buying NO lowers it", () => {
    const pool = seedPool(1000, 0.5);
    expect(buy(pool, "yes", 100).probAfter).toBeGreaterThan(0.5);
    expect(buy(pool, "no", 100).probAfter).toBeLessThan(0.5);
  });

  it("matches the worked example from the plan: 100 on a 50% market", () => {
    // Seed 1000/1000, p = 0.5, buy YES for 100:
    // k = 1000; pool becomes 1100/1100; newYes = 1000^2 / 1100 = 909.09;
    // shares = 190.9; prob after = 1100 / (1100 + 909.09) = 0.5475.
    const q = buy(seedPool(1000, 0.5), "yes", 100);
    expect(close(q.amount, 190.909, 1e-2)).toBe(true);
    expect(close(q.probAfter, 0.5475, 1e-3)).toBe(true);
  });

  it("a share always costs less than 1 and more than the price before", () => {
    const pool = seedPool(1000, 0.5);
    const q = buy(pool, "yes", 400);
    const avg = 400 / q.amount;
    expect(avg).toBeGreaterThan(q.probBefore);
    expect(avg).toBeLessThan(1);
  });

  it("never reaches 100% no matter how much is bought", () => {
    const q = buy(seedPool(100, 0.5), "yes", 1_000_000);
    expect(q.probAfter).toBeLessThan(1);
    expect(q.probAfter).toBeGreaterThan(0.99);
  });

  it("a bigger seed moves the price less for the same trade", () => {
    const small = buy(seedPool(500, 0.5), "yes", 100).probAfter;
    const big = buy(seedPool(5000, 0.5), "yes", 100).probAfter;
    expect(big - 0.5).toBeLessThan(small - 0.5);
  });

  it("rejects a non-positive amount", () => {
    expect(() => buy(seedPool(1000, 0.5), "yes", 0)).toThrow();
    expect(() => buy(seedPool(1000, 0.5), "yes", -5)).toThrow();
  });
});

describe("costToBuyShares", () => {
  it("inverts buy", () => {
    const pool = seedPool(1000, 0.4);
    const target = 150;
    const cost = costToBuyShares(pool, "no", target);
    expect(close(buy(pool, "no", cost).amount, target, 1e-6)).toBe(true);
  });
});

describe("sell", () => {
  it("buy then sell the same shares returns the money (no fee here)", () => {
    const pool = seedPool(1000, 0.5);
    const bought = buy(pool, "yes", 250);
    const sold = sell(bought.pool, "yes", bought.amount);
    expect(close(sold.amount, 250, 1e-6)).toBe(true);
    // ...and leaves the pool where it started.
    expect(close(sold.pool.yes, pool.yes, 1e-6)).toBe(true);
    expect(close(sold.pool.no, pool.no, 1e-6)).toBe(true);
  });

  it("round-trips at a skewed p as well", () => {
    const pool = seedPool(800, 0.25);
    const bought = buy(pool, "no", 120);
    const sold = sell(bought.pool, "no", bought.amount);
    expect(close(sold.amount, 120, 1e-6)).toBe(true);
  });

  it("selling YES lowers the probability", () => {
    const bought = buy(seedPool(1000, 0.5), "yes", 300);
    const sold = sell(bought.pool, "yes", bought.amount / 2);
    expect(sold.probAfter).toBeLessThan(sold.probBefore);
  });

  it("the plan's story: buy at 50, others push it to ~80, sell at a profit", () => {
    let pool: Pool = seedPool(2000, 0.5);
    const mine = buy(pool, "yes", 5000);
    pool = mine.pool;
    // The crowd piles in.
    pool = buy(pool, "yes", 20000).pool;
    expect(probability(pool)).toBeGreaterThan(0.75);
    const out = sell(pool, "yes", mine.amount);
    expect(out.amount).toBeGreaterThan(5000);
  });

  it("proceeds never exceed one per share", () => {
    const bought = buy(seedPool(1000, 0.5), "yes", 900);
    const sold = sell(bought.pool, "yes", bought.amount);
    expect(sold.amount / bought.amount).toBeLessThan(1);
  });
});

describe("price", () => {
  it("YES and NO prices sum to 1", () => {
    const pool = buy(seedPool(1000, 0.35), "yes", 77).pool;
    expect(close(price(pool, "yes") + price(pool, "no"), 1)).toBe(true);
  });
});
