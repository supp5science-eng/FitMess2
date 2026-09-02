import { describe, expect, it } from "vitest";
import { buy, seedPool } from "../amm";
import { markToMarket, netWorth, payout, voidRefunds } from "../settle";

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

describe("payout", () => {
  it("winning shares pay 1, losing shares pay 0", () => {
    const pos = { yes: 120, no: 30 };
    expect(payout(pos, "yes")).toBe(120);
    expect(payout(pos, "no")).toBe(30);
  });
});

describe("markToMarket", () => {
  it("values a position at the current prices", () => {
    const pool = seedPool(1000, 0.5);
    expect(close(markToMarket({ yes: 100, no: 0 }, pool), 50)).toBe(true);
    expect(close(markToMarket({ yes: 100, no: 100 }, pool), 100)).toBe(true);
  });

  it("goes up for a YES holder when the crowd buys YES", () => {
    const pool = seedPool(1000, 0.5);
    const before = markToMarket({ yes: 100, no: 0 }, pool);
    const after = markToMarket({ yes: 100, no: 0 }, buy(pool, "yes", 500).pool);
    expect(after).toBeGreaterThan(before);
  });
});

describe("voidRefunds", () => {
  it("returns each user's net spend, and nothing to a user who already got out ahead", () => {
    const refunds = voidRefunds([
      { userId: "ana", kind: "buy", side: "yes", currency: 1000 },
      { userId: "ana", kind: "sell", side: "yes", currency: 300 },
      { userId: "boris", kind: "buy", side: "no", currency: 400 },
      { userId: "ceca", kind: "buy", side: "yes", currency: 200 },
      { userId: "ceca", kind: "sell", side: "yes", currency: 350 },
    ]);
    expect(refunds.get("ana")).toBe(700);
    expect(refunds.get("boris")).toBe(400);
    expect(refunds.get("ceca")).toBe(0);
  });
});

describe("netWorth", () => {
  it("is cash plus marked positions", () => {
    const pool = seedPool(1000, 0.5);
    const worth = netWorth(5000, [{ position: { yes: 200, no: 0 }, pool }]);
    expect(close(worth, 5100)).toBe(true);
  });
});
