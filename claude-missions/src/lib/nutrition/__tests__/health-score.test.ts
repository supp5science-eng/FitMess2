import { describe, expect, it } from "vitest";

import {
  computeHealthScore,
  MIN_KCAL_FOR_SCORE,
  type HealthScoreInput,
} from "@/lib/nutrition/health-score";
import { computeMicroTotals, microTargetsForKcal } from "@/lib/nutrition/micro";
import type { MicroLogInput } from "@/lib/nutrition/micro";

const TARGET_KCAL = 2000;
const TARGET_PROTEIN = 150;

/** Builds a scoring input from log rows, exactly like the home screen does. */
function scoreFor(logs: MicroLogInput[], overrides: Partial<HealthScoreInput> = {}) {
  const micros = computeMicroTotals(logs);
  const consumedKcal = logs.reduce((sum, log) => sum + log.kcal, 0);
  return computeHealthScore({
    consumedKcal,
    consumedProteinG: 0,
    micros,
    targetKcal: TARGET_KCAL,
    targetProteinG: TARGET_PROTEIN,
    microTargets: microTargetsForKcal(TARGET_KCAL),
    ...overrides,
  });
}

describe("computeHealthScore: N/A states", () => {
  it("has no score for an empty day, and says why", () => {
    const score = scoreFor([]);
    expect(score.score).toBeNull();
    expect(score.labelSr).toBeNull();
    expect(score.fillFraction).toBe(0);
    expect(score.noteSr).toContain("Unesi");
  });

  it("has no score below the minimum logged kcal", () => {
    const score = scoreFor([
      { kcal: MIN_KCAL_FOR_SCORE - 1, grams: 50, fiber: 2, sugar: 1, sodium: 10, sat_fat: 0 },
    ]);
    expect(score.score).toBeNull();
  });

  it("refuses to score a day it barely knows anything about", () => {
    // 300 of 1300 kcal described = 23% coverage, under the 50% floor.
    const score = scoreFor([
      { kcal: 300, grams: 200, fiber: 5, sugar: 5, sodium: 300, sat_fat: 2 },
      { kcal: 1000, grams: 500 },
    ]);
    expect(score.score).toBeNull();
    expect(score.noteSr).toContain("nemamo podatke");
  });
});

describe("computeHealthScore: density, not daily totals", () => {
  it("gives a partial day the SAME score as the full day at equal quality", () => {
    // Quarter of the calories, quarter of everything else: on track, not behind.
    const quarterDay = scoreFor(
      [{ kcal: 500, grams: 400, fiber: 7, sugar: 12.5, sodium: 575, sat_fat: 5.5 }],
      { consumedProteinG: 37.5 }
    );
    const fullDay = scoreFor(
      [{ kcal: 2000, grams: 1600, fiber: 28, sugar: 50, sodium: 2300, sat_fat: 22 }],
      { consumedProteinG: 150 }
    );

    expect(quarterDay.score).not.toBeNull();
    expect(quarterDay.score).toBeCloseTo(fullDay.score as number, 5);
  });

  it("a clean, protein- and fiber-rich day scores near the top", () => {
    const score = scoreFor(
      [
        {
          kcal: 1800,
          grams: 1500,
          fiber: 32,
          sugar: 18,
          sodium: 1100,
          sat_fat: 8,
        },
      ],
      { consumedProteinG: 155 }
    );
    expect(score.score).toBeGreaterThanOrEqual(9);
    expect(score.labelSr).toBe("Odlično");
  });

  it("a salty, sugary, fiberless day scores low and names the weakest link", () => {
    const score = scoreFor(
      [
        {
          kcal: 1800,
          grams: 900,
          fiber: 1,
          sugar: 120,
          sodium: 5200,
          sat_fat: 45,
        },
      ],
      { consumedProteinG: 40 }
    );
    expect(score.score).toBeLessThan(4);
    expect(score.labelSr).toBe("Ima prostora");
    expect(score.noteSr.length).toBeGreaterThan(0);
  });

  it("sitting exactly ON a limit is not treated as a failure", () => {
    const score = scoreFor(
      [{ kcal: 2000, grams: 1600, fiber: 28, sugar: 50, sodium: 2300, sat_fat: 22 }],
      { consumedProteinG: 150 }
    );
    // Full marks on both goals, ~55% on each of the three limits.
    expect(score.score).toBeGreaterThan(6);
    expect(score.score).toBeLessThan(9);
  });
});

describe("computeHealthScore: missing data", () => {
  it("excludes nutrients it knows nothing about instead of scoring them 0", () => {
    // Fiber known for the whole day, the other three unknown. In practice micros
    // arrive as a SET of four (the estimators fill all of them or none), so this
    // is the defensive case -- and the honest answer is still "no score", because
    // coverage is taken from the worst-described nutrient. What must NOT happen
    // is the unknown three being read as "zero sodium, zero sugar" and inflating
    // a perfect grade.
    const logs: MicroLogInput[] = [{ kcal: 1000, grams: 800, fiber: 14 }];
    const score = computeHealthScore({
      consumedKcal: 1000,
      consumedProteinG: 75,
      micros: computeMicroTotals(logs),
      targetKcal: TARGET_KCAL,
      targetProteinG: TARGET_PROTEIN,
      microTargets: microTargetsForKcal(TARGET_KCAL),
    });

    expect(score.score).toBeNull();
    const unscored = score.components.filter((c) => c.points === null);
    expect(unscored.map((c) => c.key).sort()).toEqual([
      "satFat",
      "sodium",
      "sugar",
    ]);
    // Fiber, which we DO know, was still measured -- and measured as on-target.
    const fiber = score.components.find((c) => c.key === "fiber");
    expect(fiber?.points).toBe(2);
  });

  it("scores a partially-described day on the entries it does know", () => {
    // 70% of the day's kcal fully described, 30% unknown: above the coverage
    // floor, so it gets a score -- computed from the described 70% only, with a
    // coverage note rendered alongside by the cards.
    const logs: MicroLogInput[] = [
      { kcal: 1400, grams: 1000, fiber: 22, sugar: 14, sodium: 800, sat_fat: 6 },
      { kcal: 600, grams: 400 },
    ];
    const score = computeHealthScore({
      consumedKcal: 2000,
      consumedProteinG: 150,
      micros: computeMicroTotals(logs),
      targetKcal: TARGET_KCAL,
      targetProteinG: TARGET_PROTEIN,
      microTargets: microTargetsForKcal(TARGET_KCAL),
    });

    expect(score.score).not.toBeNull();
    expect(score.components.every((c) => c.points !== null)).toBe(true);
  });

  it("exposes every component for the breakdown, scored or not", () => {
    const score = scoreFor([
      { kcal: 800, grams: 600, fiber: 10, sugar: 20, sodium: 900, sat_fat: 9 },
    ]);
    expect(score.components.map((c) => c.key)).toEqual([
      "protein",
      "fiber",
      "sugar",
      "sodium",
      "satFat",
    ]);
  });
});

describe("computeHealthScore: robustness", () => {
  it("never throws on a zero/absent target (no plan set yet)", () => {
    const score = computeHealthScore({
      consumedKcal: 900,
      consumedProteinG: 40,
      micros: computeMicroTotals([
        { kcal: 900, grams: 500, fiber: 8, sugar: 20, sodium: 800, sat_fat: 7 },
      ]),
      targetKcal: 0,
      targetProteinG: 0,
      microTargets: microTargetsForKcal(0),
    });
    expect(score.score === null || Number.isFinite(score.score)).toBe(true);
  });

  it("clamps the score into 0..10 and the bar into 0..1", () => {
    const score = scoreFor(
      [{ kcal: 2000, grams: 2000, fiber: 200, sugar: 0, sodium: 0, sat_fat: 0 }],
      { consumedProteinG: 900 }
    );
    expect(score.score).toBeLessThanOrEqual(10);
    expect(score.fillFraction).toBeLessThanOrEqual(1);
    expect(score.fillFraction).toBeGreaterThanOrEqual(0);
  });
});
