import { describe, expect, it } from "vitest";

import {
  computeMicroCardState,
  computeMicroTotals,
  formatMicroAmount,
  microForGrams,
  microTargetsForKcal,
  resolveLogMicros,
  saltGramsFromSodiumMg,
  SODIUM_MG_LIMIT,
} from "@/lib/nutrition/micro";

describe("microTargetsForKcal", () => {
  it("scales fiber with the calorie budget (14 g / 1000 kcal)", () => {
    expect(microTargetsForKcal(2000).fiber).toBe(28);
    expect(microTargetsForKcal(2500).fiber).toBe(35);
  });

  it("derives sugar from 10% of energy and saturated fat from 10% of energy", () => {
    const targets = microTargetsForKcal(2000);
    // 2000 * 0.10 / 4 kcal per gram
    expect(targets.sugar).toBe(50);
    // 2000 * 0.10 / 9 kcal per gram
    expect(targets.satFat).toBe(22);
  });

  it("keeps sodium a flat daily limit, independent of the calorie budget", () => {
    expect(microTargetsForKcal(1200).sodium).toBe(SODIUM_MG_LIMIT);
    expect(microTargetsForKcal(4000).sodium).toBe(SODIUM_MG_LIMIT);
  });

  it("clamps the extremes so a tiny or huge budget still reads sensibly", () => {
    const low = microTargetsForKcal(800);
    expect(low.fiber).toBe(20); // floor, not 11
    expect(low.sugar).toBe(20);
    expect(low.satFat).toBe(10);

    const high = microTargetsForKcal(6000);
    expect(high.fiber).toBe(45); // ceiling, not 84
    expect(high.sugar).toBe(100);
    expect(high.satFat).toBe(40);
  });

  it("degrades to the sane minimum for a missing/absurd budget, never throws", () => {
    expect(microTargetsForKcal(0).fiber).toBe(20);
    expect(microTargetsForKcal(Number.NaN).sugar).toBe(20);
    expect(microTargetsForKcal(-500).satFat).toBe(10);
  });
});

describe("saltGramsFromSodiumMg", () => {
  it("converts sodium mg to salt grams (x2.5 / 1000)", () => {
    expect(saltGramsFromSodiumMg(2300)).toBe(5.8);
    expect(saltGramsFromSodiumMg(400)).toBe(1);
  });
});

describe("microForGrams", () => {
  it("scales per-100g values to the portion, one decimal", () => {
    const micros = microForGrams(
      {
        fiber_100g: 2.5,
        sugar_100g: 4,
        sodium_100g: 400,
        sat_fat_100g: 1.2,
      },
      250
    );
    expect(micros).toEqual({
      fiber: 6.3,
      sugar: 10,
      sodium: 1000,
      satFat: 3,
    });
  });

  it("keeps UNKNOWN unknown -- a missing per-100g value never becomes 0", () => {
    const micros = microForGrams(
      { fiber_100g: 3, sugar_100g: null, sodium_100g: undefined },
      100
    );
    expect(micros.fiber).toBe(3);
    expect(micros.sugar).toBeNull();
    expect(micros.sodium).toBeNull();
    expect(micros.satFat).toBeNull();
  });

  it("returns all-unknown for a missing food or a nonsense portion", () => {
    expect(microForGrams(null, 100).fiber).toBeNull();
    expect(microForGrams({ fiber_100g: 5 }, 0).fiber).toBeNull();
  });

  it("treats a negative/non-finite stored value as unknown, not as data", () => {
    expect(
      microForGrams({ fiber_100g: -4, sugar_100g: Number.NaN }, 100)
    ).toEqual({ fiber: null, sugar: null, sodium: null, satFat: null });
  });
});

describe("resolveLogMicros", () => {
  it("prefers the log's own snapshot", () => {
    const micros = resolveLogMicros({
      kcal: 200,
      grams: 100,
      fiber: 9,
      food: { fiber_100g: 2 },
    });
    expect(micros.fiber).toBe(9);
  });

  it("falls back to the referenced food's per-100g values when the snapshot is unknown", () => {
    // This is what makes the AI catalog backfill work retroactively: entries
    // logged before their food had micro data become complete without any log
    // row being rewritten.
    const micros = resolveLogMicros({
      kcal: 200,
      grams: 200,
      fiber: null,
      sugar: undefined,
      food: { fiber_100g: 3, sugar_100g: 1.5 },
    });
    expect(micros.fiber).toBe(6);
    expect(micros.sugar).toBe(3);
  });

  it("stays unknown when neither the log nor a food knows", () => {
    expect(
      resolveLogMicros({ kcal: 500, grams: 300, food: null })
    ).toEqual({ fiber: null, sugar: null, sodium: null, satFat: null });
  });
});

describe("computeMicroTotals", () => {
  it("sums only the entries that HAVE values, tracking the kcal they covered", () => {
    const result = computeMicroTotals([
      { kcal: 300, grams: 150, fiber: 4, sugar: 6, sodium: 500, sat_fat: 2 },
      // A meal we know nothing about: contributes kcal but no micros.
      { kcal: 200, grams: 100 },
    ]);

    expect(result.totals.fiber.value).toBe(4);
    expect(result.totals.fiber.coveredKcal).toBe(300);
    expect(result.totals.fiber.hasData).toBe(true);
    expect(result.totalKcal).toBe(500);
    // 300 of 500 kcal described.
    expect(result.coverage).toBeCloseTo(0.6);
  });

  it("reports full coverage for an empty day (nothing is unknown yet)", () => {
    const result = computeMicroTotals([]);
    expect(result.coverage).toBe(1);
    expect(result.totalKcal).toBe(0);
    expect(result.totals.sodium.hasData).toBe(false);
  });

  it("takes coverage from the WORST-described nutrient", () => {
    const result = computeMicroTotals([
      { kcal: 400, grams: 200, fiber: 5, sugar: 3, sodium: 200, sat_fat: 1 },
      // Fiber known, sodium not -> coverage must reflect the sodium gap.
      { kcal: 400, grams: 200, fiber: 2 },
    ]);
    expect(result.totals.fiber.coveredKcal).toBe(800);
    expect(result.totals.sodium.coveredKcal).toBe(400);
    expect(result.coverage).toBeCloseTo(0.5);
  });

  it("resolves the food fallback while summing", () => {
    const result = computeMicroTotals([
      { kcal: 250, grams: 200, food: { fiber_100g: 2, sodium_100g: 300 } },
    ]);
    expect(result.totals.fiber.value).toBe(4);
    expect(result.totals.sodium.value).toBe(600);
    expect(result.coverage).toBeLessThan(1); // sugar/satFat still unknown
  });
});

describe("computeMicroCardState", () => {
  it("derives remaining + fill for a nutrient under its target", () => {
    const card = computeMicroCardState(
      "fiber",
      { value: 12, coveredKcal: 800, hasData: true },
      28
    );
    expect(card.consumed).toBe(12);
    expect(card.target).toBe(28);
    expect(card.remaining).toBe(16);
    expect(card.isOver).toBe(false);
    expect(card.fillFraction).toBeCloseTo(12 / 28);
    expect(card.spec.kind).toBe("goal");
  });

  it("goes NEGATIVE (not stuck at 0) once past a limit, with the ring full", () => {
    const card = computeMicroCardState(
      "sodium",
      { value: 3100, coveredKcal: 1500, hasData: true },
      2300
    );
    expect(card.remaining).toBe(-800);
    expect(card.isOver).toBe(true);
    expect(card.fillFraction).toBe(1);
  });

  it("flags no-data so the card can render a dash instead of a confident zero", () => {
    const card = computeMicroCardState(
      "sugar",
      { value: 0, coveredKcal: 0, hasData: false },
      50
    );
    expect(card.hasData).toBe(false);
    expect(card.consumed).toBe(0);
  });
});

describe("formatMicroAmount", () => {
  it("groups thousands the Serbian way and appends the unit", () => {
    expect(formatMicroAmount(2300, "mg")).toBe("2.300 mg");
    expect(formatMicroAmount(38, "g")).toBe("38 g");
  });

  it("keeps a negative sign (the 'over the limit' headline)", () => {
    expect(formatMicroAmount(-800, "mg")).toBe("-800 mg");
  });
});
