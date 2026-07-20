import { describe, expect, it } from "vitest";

import {
  computeDayTotals,
  computeRemaining,
  computeRingState,
} from "@/lib/home/totals";

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

describe("computeRingState: traffic-light level + signed remaining + fills", () => {
  it("is green when more than half the budget is left", () => {
    const s = computeRingState(500, 2000); // 75% left
    expect(s.level).toBe("green");
    expect(s.remainingKcal).toBe(1500);
    expect(s.isOver).toBe(false);
    expect(s.fillFraction).toBeCloseTo(0.25, 5);
    expect(s.overshootFraction).toBe(0);
  });

  it("is yellow between 15% and 50% left", () => {
    expect(computeRingState(1000, 2000).level).toBe("yellow"); // exactly 50% -> not > 50 -> yellow
    expect(computeRingState(1600, 2000).level).toBe("yellow"); // 20% left
  });

  it("is red under 15% left (still under the limit)", () => {
    const s = computeRingState(1800, 2000); // 10% left
    expect(s.level).toBe("red");
    expect(s.isOver).toBe(false);
    expect(s.remainingKcal).toBe(200);
  });

  it("goes negative and red over the limit, with a second-lap fraction", () => {
    const s = computeRingState(3500, 3000);
    expect(s.level).toBe("red");
    expect(s.isOver).toBe(true);
    expect(s.remainingKcal).toBe(-500); // signed: 500 into the minus
    expect(s.overshootKcal).toBe(500);
    expect(s.fillFraction).toBe(1); // first lap is full
    expect(s.overshootFraction).toBeCloseTo(500 / 3000, 5);
  });

  it("caps the second lap at a full lap for an extreme overshoot", () => {
    const s = computeRingState(9000, 3000); // 200% over
    expect(s.fillFraction).toBe(1);
    expect(s.overshootFraction).toBe(1);
  });

  it("rounds every kcal number to a whole value", () => {
    const s = computeRingState(1200.6, 2000);
    expect(Number.isInteger(s.consumedKcal)).toBe(true);
    expect(Number.isInteger(s.remainingKcal)).toBe(true);
    expect(s.remainingKcal).toBe(799);
  });
});
