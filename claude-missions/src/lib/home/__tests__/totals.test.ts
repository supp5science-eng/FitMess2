import { describe, expect, it } from "vitest";

import { computeDayTotals, computeRemaining } from "@/lib/home/totals";

describe("F027: computeDayTotals -- AS-048/AS-049 sum of today's logs", () => {
  it("sums kcal/protein/carbs/fat across every log", () => {
    const totals = computeDayTotals([
      { kcal: 300, protein: 20, carbs: 30, fat: 10 },
      { kcal: 150, protein: 5, carbs: 15, fat: 5 },
    ]);

    expect(totals).toEqual({ kcal: 450, protein: 25, carbs: 45, fat: 15 });
  });

  it("sums to all-zero for an empty day (the empty-state case)", () => {
    expect(computeDayTotals([])).toEqual({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe("F027: computeRemaining -- AS-047 (remaining) / AS-050 (overshoot)", () => {
  it("AS-047: returns the whole-kcal amount remaining when under budget", () => {
    const result = computeRemaining(1200, 2000);
    expect(result).toEqual({
      remainingKcal: 800,
      isOver: false,
      overshootKcal: 0,
    });
  });

  it("AS-047: remaining is exactly 0 (not over) when consumed exactly equals target", () => {
    const result = computeRemaining(2000, 2000);
    expect(result.remainingKcal).toBe(0);
    expect(result.isOver).toBe(false);
    expect(result.overshootKcal).toBe(0);
  });

  it("AS-050: reports the overshoot amount once consumed exceeds the daily target", () => {
    const result = computeRemaining(2300, 2000);
    expect(result).toEqual({
      remainingKcal: 0,
      isOver: true,
      overshootKcal: 300,
    });
  });

  it("AS-047/AS-050: rounds to whole kcal, matching the budget engine's rounding rule", () => {
    const under = computeRemaining(1200.4, 2000);
    expect(Number.isInteger(under.remainingKcal)).toBe(true);

    const over = computeRemaining(2200.6, 2000);
    expect(Number.isInteger(over.overshootKcal)).toBe(true);
    expect(over.overshootKcal).toBe(201);
  });

  it("never throws and clamps to a sane result for a non-positive target", () => {
    const result = computeRemaining(500, 0);
    expect(result.isOver).toBe(true);
    expect(result.overshootKcal).toBeGreaterThanOrEqual(0);
  });
});
