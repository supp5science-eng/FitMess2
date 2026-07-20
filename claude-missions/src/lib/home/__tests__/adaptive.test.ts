import { describe, expect, it } from "vitest";

import {
  computeAdaptivePlan,
  computeCarryInFromLastWeek,
} from "@/lib/home/adaptive";

// Deterministic "now": Wednesday 2026-01-07 (week starts Monday 2026-01-05).
// Mon = index 0, Tue = 1, Wed(today) = 2 -> elapsed 3, 5 days left.
const WED = new Date("2026-01-07T12:00:00.000Z");
const MON = "2026-01-05T12:00:00.000Z";
const TUE = "2026-01-06T12:00:00.000Z";
const WED_LOG = "2026-01-07T12:00:00.000Z";

function log(logged_at: string, kcal: number) {
  return { logged_at, kcal };
}

describe("computeAdaptivePlan: redistribute an overshoot across the rest of the week", () => {
  it("trims the remaining days after an earlier-in-week overshoot", () => {
    // Mon+Tue: 3000 each (base 2000 -> 1000 over each day, 2000 total over).
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    // Weekly budget 14000, spent-before-today 6000, 5 days left -> 1600/day.
    expect(plan.spentBeforeToday).toBe(6000);
    expect(plan.daysLeftIncludingToday).toBe(5);
    expect(plan.adaptiveDailyTarget).toBe(1600);
    expect(plan.trimmedKcal).toBe(400);
    expect(plan.isAdjusted).toBe(true);
    expect(plan.trainingSuggestionKcal).toBe(0);
  });

  it("does not count today's own logs in spent-before-today", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000), log(WED_LOG, 900)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    expect(plan.spentBeforeToday).toBe(6000); // today's 900 excluded
    expect(plan.adaptiveDailyTarget).toBe(1600);
  });

  it("clamps at the safe floor and suggests activity for the part food can't cover", () => {
    // Huge overshoot: Mon 8000 + Tue 3000 = 11000 before today.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 8000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    // remaining 3000 / 5 = 600/day ideal, below the 1400 male floor.
    expect(plan.adaptiveDailyTarget).toBe(1400);
    expect(plan.trainingSuggestionKcal).toBe(800); // 1400 - 600, rounded to 50
    expect(plan.trainingWalkMinutes).toBeGreaterThan(0);
    expect(plan.isAdjusted).toBe(true);
  });

  it("stays at base when the week is on track (no adjustment)", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 2000), log(TUE, 2000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(2000);
    expect(plan.trimmedKcal).toBe(0);
    expect(plan.isAdjusted).toBe(false);
  });

  it("never rewards under-eating with a target above base (no binge day)", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 1000), log(TUE, 1000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(2000); // capped at base, not 2400
    expect(plan.isAdjusted).toBe(false);
  });

  it("applies a carried-in debt from last week on top of this week's spend", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      carryInKcal: 2000,
      now: WED,
    });
    // remaining 14000 - 6000 - 2000 = 6000 / 5 = 1200 -> below floor -> 1400.
    expect(plan.adaptiveDailyTarget).toBe(1400);
    expect(plan.trainingSuggestionKcal).toBe(200);
  });
});

describe("computeCarryInFromLastWeek: 1-week debt lookback", () => {
  it("carries the amount last week went over budget", () => {
    // base 2000 -> weekly budget 14000; last week logged 16000 -> 2000 debt.
    const carry = computeCarryInFromLastWeek(
      [log("2025-12-29T12:00:00.000Z", 16000)],
      2000
    );
    expect(carry).toBe(2000);
  });

  it("carries nothing when last week was under budget", () => {
    const carry = computeCarryInFromLastWeek(
      [log("2025-12-29T12:00:00.000Z", 10000)],
      2000
    );
    expect(carry).toBe(0);
  });
});
