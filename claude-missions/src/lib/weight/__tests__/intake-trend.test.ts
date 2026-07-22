import { describe, expect, it } from "vitest";

import {
  computeIntakeTrend,
  type IntakeLogInput,
} from "@/lib/weight/intake-trend";

// Deterministic "now": Wednesday 2026-07-22, 14:00 Europe/Belgrade.
// The 7-day window is 2026-07-16 .. 2026-07-22.
const NOW = new Date("2026-07-22T12:00:00Z");
const WINDOW = [
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
  "2026-07-20",
  "2026-07-21",
  "2026-07-22",
];

function everyDay(
  kcal: number,
  macros: { protein: number; carbs: number; fat: number }
): IntakeLogInput[] {
  return WINDOW.map((d) => ({
    logged_at: `${d}T10:00:00Z`,
    kcal,
    ...macros,
  }));
}

const PARAMS = {
  tdeeKcal: 2000,
  currentWeightKg: 90,
  targetFatG: 70,
  targetProteinG: 150,
};

describe("computeIntakeTrend", () => {
  it("estimates a loss from a calorie deficit and anchors today at current weight", () => {
    // 500 kcal/day under maintenance for 7 days.
    const logs = everyDay(1500, { protein: 150, carbs: 150, fat: 50 });
    const trend = computeIntakeTrend(logs, NOW, PARAMS);

    expect(trend.loggedDaysCount).toBe(7);
    // Last point is anchored to the real current weight.
    expect(trend.points).toHaveLength(7);
    expect(trend.points[6]!.estWeightKg).toBe(90);
    // 6 × −500 kcal ÷ 7700 kcal/kg ≈ −0.39 → −0.4 kg.
    expect(trend.estChangeKg).toBe(-0.4);
    // Macros within plan, mild deficit -> "on track".
    expect(trend.noteKind).toBe("on_track");
  });

  it("flags high fat intake over the plan's fat target", () => {
    // Fat 100 g vs a 70 g target (× 1.2 = 84) -> fat_high wins even over surplus.
    const logs = everyDay(2200, { protein: 150, carbs: 200, fat: 100 });
    const trend = computeIntakeTrend(logs, NOW, PARAMS);

    expect(trend.noteKind).toBe("fat_high");
    expect(trend.estChangeKg).toBeGreaterThan(0); // surplus -> estimated gain
  });

  it("flags low protein when well under the plan's protein target", () => {
    // Protein 90 g vs a 150 g target (× 0.8 = 120); fat within plan.
    const logs = everyDay(1900, { protein: 90, carbs: 250, fat: 50 });
    const trend = computeIntakeTrend(logs, NOW, PARAMS);

    expect(trend.noteKind).toBe("protein_low");
  });

  it("empty logs => flat line at current weight, no change, no-data note", () => {
    const trend = computeIntakeTrend([], NOW, PARAMS);

    expect(trend.loggedDaysCount).toBe(0);
    expect(trend.estChangeKg).toBe(0);
    expect(trend.noteKind).toBe("no_data");
    expect(trend.points.every((p) => p.estWeightKg === 90)).toBe(true);
  });
});
