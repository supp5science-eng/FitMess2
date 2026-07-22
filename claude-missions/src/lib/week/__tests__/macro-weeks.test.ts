import { describe, expect, it } from "vitest";

import { computeMacroWeeks, type MacroLogInput } from "@/lib/week/macro-weeks";

// Deterministic "now": Wednesday 2026-07-22, 14:00 Europe/Belgrade (CEST).
// This week (Mon..Sun) = 2026-07-20 .. 2026-07-26; last week = 07-13 .. 07-19.
const NOW = new Date("2026-07-22T12:00:00Z");

describe("computeMacroWeeks", () => {
  it("averages over LOGGED days only (a single logged day == that day's kcal)", () => {
    const logs: MacroLogInput[] = [
      { logged_at: "2026-07-22T10:00:00Z", kcal: 500, protein: 40, carbs: 60, fat: 10 },
    ];

    const weeks = computeMacroWeeks(logs, NOW, 4);

    expect(weeks).toHaveLength(4);
    expect(weeks[0]!.loggedDaysCount).toBe(1);
    // 500 / 1 logged day = 500, NOT 500 / 7 or 500 / elapsed days.
    expect(weeks[0]!.dailyAverageKcal).toBe(500);
  });

  it("splits each day's bar into macro segments that sum back to its kcal", () => {
    const logs: MacroLogInput[] = [
      { logged_at: "2026-07-22T10:00:00Z", kcal: 500, protein: 40, carbs: 60, fat: 10 },
    ];

    const wed = computeMacroWeeks(logs, NOW, 4)[0]!.days.find(
      (d) => d.dayKey === "2026-07-22"
    )!;

    expect(wed.label).toBe("Sre");
    expect(wed.totalKcal).toBe(500);
    expect(wed.proteinKcal + wed.carbsKcal + wed.fatKcal).toBe(wed.totalKcal);
    // Fat (9 kcal/g) is the smallest contributor here.
    expect(wed.fatKcal).toBeLessThan(wed.carbsKcal);
  });

  it("computes week-over-week percent change vs the prior week's average", () => {
    const logs: MacroLogInput[] = [
      // This week: avg 500 (one day).
      { logged_at: "2026-07-22T10:00:00Z", kcal: 500, protein: 40, carbs: 60, fat: 10 },
      // Last week: avg (600 + 800) / 2 = 700.
      { logged_at: "2026-07-14T10:00:00Z", kcal: 600, protein: 50, carbs: 70, fat: 20 },
      { logged_at: "2026-07-16T10:00:00Z", kcal: 800, protein: 60, carbs: 90, fat: 25 },
    ];

    const weeks = computeMacroWeeks(logs, NOW, 4);

    expect(weeks[1]!.dailyAverageKcal).toBe(700);
    // (500 - 700) / 700 = -28.57% -> -29
    expect(weeks[0]!.changePct).toBe(-29);
  });

  it("marks not-yet-reached days of THIS week as future and unlogged", () => {
    const week = computeMacroWeeks([], NOW, 4)[0]!;
    const sunday = week.days.find((d) => d.dayKey === "2026-07-26")!;

    expect(sunday.isFuture).toBe(true);
    expect(sunday.logged).toBe(false);
  });

  it("empty logs => zero average, zero logged days, and no change badge", () => {
    const weeks = computeMacroWeeks([], NOW, 4);

    expect(weeks[0]!.loggedDaysCount).toBe(0);
    expect(weeks[0]!.dailyAverageKcal).toBe(0);
    expect(weeks[0]!.changePct).toBeNull();
  });
});
