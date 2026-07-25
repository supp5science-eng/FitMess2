import { describe, expect, it } from "vitest";

import {
  MAX_TRAINING_SUGGESTION_KCAL,
  computeAdaptivePlan,
  computeCarryInFromLastWeek,
} from "@/lib/home/adaptive";
import { FALLBACK_STEP_GOAL } from "@/lib/steps/step-goal";

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

  it("never cuts one day by more than the trim cap, however big the overshoot", () => {
    // Huge overshoot: Mon 8000 + Tue 3000 = 11000 before today.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 8000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    // remaining 3000 / 5 = 600/day "ideal" -- but a 25% cap on a 2000 base
    // means today never goes below 1500, even though the floor is 1400.
    expect(plan.adaptiveDailyTarget).toBe(1500);
    expect(plan.trimmedKcal).toBe(500);
    // The rest is NOT chased today: capped activity, remainder rolls to next
    // week as ordinary carry-in.
    expect(plan.trainingSuggestionKcal).toBe(MAX_TRAINING_SUGGESTION_KCAL);
    expect(plan.trainingWalkMinutes).toBeGreaterThan(0);
    expect(plan.isAdjusted).toBe(true);
  });

  it("keeps the sex floor binding when it is stricter than the trim cap", () => {
    // Small base: 25% of 1600 is 1200, below the 1400 male floor -> floor wins.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 6000), log(TUE, 6000)],
      baseDailyTarget: 1600,
      sex: "male",
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(1400);
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
    // remaining 14000 - 6000 - 2000 = 6000 / 5 = 1200 -> below the 1500 trim
    // cap -> 1500, with the shortfall covered by capped activity.
    expect(plan.adaptiveDailyTarget).toBe(1500);
    expect(plan.trainingSuggestionKcal).toBe(MAX_TRAINING_SUGGESTION_KCAL);
  });
});

describe("goal awareness: under-eating is only corrected upward where the goal is a number to HIT", () => {
  const underEatenWeek = [log(MON, 1000), log(TUE, 1000)];

  it("raises the remaining days on a bulk, so a missed day is not silently lost", () => {
    const plan = computeAdaptivePlan({
      weekLogs: underEatenWeek,
      baseDailyTarget: 2000,
      sex: "male",
      goal: "gain",
      now: WED,
    });
    // 14000 - 2000 = 12000 over 5 days = 2400 ideal, within the +20% cap.
    expect(plan.adaptiveDailyTarget).toBe(2400);
    expect(plan.liftedKcal).toBe(400);
    expect(plan.trimmedKcal).toBe(0);
    expect(plan.isAdjusted).toBe(true);
  });

  it("caps the lift so one skipped day cannot mandate a feast", () => {
    const plan = computeAdaptivePlan({
      // Nothing logged Mon/Tue at all on a bulk.
      weekLogs: [],
      baseDailyTarget: 2000,
      sex: "male",
      goal: "gain",
      now: WED,
    });
    // Ideal would be 14000/5 = 2800; the +20% cap holds it at 2400.
    expect(plan.adaptiveDailyTarget).toBe(2400);
  });

  it("corrects maintenance upward too -- maintaining also means hitting the number", () => {
    const plan = computeAdaptivePlan({
      weekLogs: underEatenWeek,
      baseDailyTarget: 2000,
      sex: "male",
      goal: "maintain",
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(2400);
  });

  it.each(["lose", "tone"] as const)(
    "leaves a cutting goal (%s) one-way: under-eating never raises the target",
    (goal) => {
      const plan = computeAdaptivePlan({
        weekLogs: underEatenWeek,
        baseDailyTarget: 2000,
        sex: "male",
        goal,
        now: WED,
      });
      expect(plan.adaptiveDailyTarget).toBe(2000);
      expect(plan.liftedKcal).toBe(0);
      expect(plan.isAdjusted).toBe(false);
    }
  );

  it("treats an unknown goal as a cutting goal (never guess someone into eating more)", () => {
    const plan = computeAdaptivePlan({
      weekLogs: underEatenWeek,
      baseDailyTarget: 2000,
      sex: "male",
      goal: null,
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(2000);
  });

  it("still trims a bulk that overshot -- the lift is not a one-way street", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      goal: "gain",
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(1600);
    expect(plan.trimmedKcal).toBe(400);
  });
});

describe("the activity suggestion and the step goal are one number, not two", () => {
  it("raises the step goal to cover the kcal food can't", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 8000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    // 250 kcal of brisk walking ~= 5000 steps on top of the user's own goal.
    expect(plan.trainingSuggestionKcal).toBe(250);
    expect(plan.extraSteps).toBe(5000);
    expect(plan.adaptiveStepGoal).toBe(FALLBACK_STEP_GOAL + 5000);
  });

  it("adds the extra steps to the USER's goal, not to a flat 10.000", () => {
    // A sedentary user's goal is 5.000; telling them 15.000 because the app
    // assumed everybody walks 10.000 is exactly the unrealistic figure this
    // feature removed.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 8000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      baseStepGoal: 5000,
      now: WED,
    });
    expect(plan.extraSteps).toBe(5000);
    expect(plan.adaptiveStepGoal).toBe(10000);
  });

  it("leaves the step goal alone when no activity is needed", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 2000), log(TUE, 2000)],
      baseDailyTarget: 2000,
      sex: "male",
      now: WED,
    });
    expect(plan.extraSteps).toBe(0);
    expect(plan.adaptiveStepGoal).toBe(FALLBACK_STEP_GOAL);
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
