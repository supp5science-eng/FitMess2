import { describe, expect, it } from "vitest";

import {
  computeRunCalories,
  DEFAULT_WEIGHT_KG,
  KCAL_PER_KG_PER_KM,
} from "@/lib/run/calories";

describe("F-runs: computeRunCalories", () => {
  it("scales with distance and body weight", () => {
    expect(computeRunCalories(1000, 70)).toBe(
      Math.round(1 * 70 * KCAL_PER_KG_PER_KM)
    ); // 73
    expect(computeRunCalories(5000, 70)).toBe(
      Math.round(5 * 70 * KCAL_PER_KG_PER_KM)
    ); // 363
    expect(computeRunCalories(5000, 90)).toBeGreaterThan(
      computeRunCalories(5000, 70)
    );
  });

  it("is zero for a zero-distance run", () => {
    expect(computeRunCalories(0, 70)).toBe(0);
    expect(computeRunCalories(-100, 70)).toBe(0);
    expect(computeRunCalories(Number.NaN, 70)).toBe(0);
  });

  it("falls back to a default weight when the profile has none", () => {
    const expected = Math.round(1 * DEFAULT_WEIGHT_KG * KCAL_PER_KG_PER_KM);
    expect(computeRunCalories(1000, null)).toBe(expected);
    expect(computeRunCalories(1000, undefined)).toBe(expected);
    expect(computeRunCalories(1000, 0)).toBe(expected);
    expect(computeRunCalories(1000, -5)).toBe(expected);
  });

  it("clamps absurd weights into a human range", () => {
    expect(computeRunCalories(1000, 1000)).toBe(
      Math.round(1 * 300 * KCAL_PER_KG_PER_KM)
    );
    expect(computeRunCalories(1000, 5)).toBe(
      Math.round(1 * 30 * KCAL_PER_KG_PER_KM)
    );
  });
});
