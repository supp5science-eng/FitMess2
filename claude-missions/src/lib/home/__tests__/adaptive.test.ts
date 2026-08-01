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
/** Same week, other vantage points -- the size of a redistribution depends
 * entirely on how many days are left to spread it over. */
const TUE_NOW = new Date("2026-01-06T12:00:00.000Z");
const THU = new Date("2026-01-08T12:00:00.000Z");
const THU_LOG = "2026-01-08T12:00:00.000Z";
const FRI = new Date("2026-01-09T12:00:00.000Z");

function log(logged_at: string, kcal: number) {
  return { logged_at, kcal };
}

// Most of these fixtures log 1000-3000 kcal days against a 2000 base. The
// trust pass (2026-08-01) reads anything below BMR as an incomplete log rather
// than a real day, so tests that mean "the user genuinely ate little" state a
// low BMR explicitly -- otherwise they would be asserting on the neutralized
// path instead of the one they describe.
const LOW_BMR = 900;

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
      bmrKcal: LOW_BMR,
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
      bmrKcal: LOW_BMR,
      now: WED,
    });
    // 14000 - 2000 = 12000 over 5 days = 2400 ideal, within the +20% cap.
    expect(plan.adaptiveDailyTarget).toBe(2400);
    expect(plan.liftedKcal).toBe(400);
    expect(plan.trimmedKcal).toBe(0);
    expect(plan.isAdjusted).toBe(true);
  });

  it("caps the lift so one genuinely tiny day cannot mandate a feast", () => {
    const plan = computeAdaptivePlan({
      // Two real but very small days, confirmed plausible by a low BMR.
      weekLogs: [log(MON, 400), log(TUE, 400)],
      baseDailyTarget: 2000,
      sex: "male",
      goal: "gain",
      bmrKcal: 300,
      now: WED,
    });
    // Ideal would be (14000 - 800) / 5 = 2640; the +20% cap holds it at 2400.
    expect(plan.adaptiveDailyTarget).toBe(2400);
  });

  it("does NOT lift a bulk on days that were simply never logged", () => {
    // The dangerous case this feature exists to kill: nothing logged Mon/Tue,
    // so the old engine read 0 kcal as fact and told a bulking user to eat
    // 2400 -- to make up food they had very likely already eaten.
    const plan = computeAdaptivePlan({
      weekLogs: [],
      baseDailyTarget: 2000,
      sex: "male",
      goal: "gain",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.adaptiveDailyTarget).toBe(2000);
    expect(plan.liftedKcal).toBe(0);
    expect(plan.isAdjusted).toBe(false);
  });

  it("corrects maintenance upward too -- maintaining also means hitting the number", () => {
    const plan = computeAdaptivePlan({
      weekLogs: underEatenWeek,
      baseDailyTarget: 2000,
      sex: "male",
      goal: "maintain",
      bmrKcal: LOW_BMR,
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
        bmrKcal: LOW_BMR,
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
      bmrKcal: LOW_BMR,
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

describe("day trust: a day only moves the plan if its log is plausible as a whole day", () => {
  it("does not read a forgotten day as a real day", () => {
    // The reported case: Tuesday holds one 122 kcal entry the user never
    // finished. Charged at base (2000) instead of 122, so Monday's real
    // overshoot is the only thing that moves the plan.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 122)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 2000,
      now: WED,
    });
    expect(plan.spentBeforeToday).toBe(5000); // 3000 real + 2000 assumed
    expect(plan.adaptiveDailyTarget).toBe(1800);
    expect(plan.untrustedDays).toHaveLength(1);
    expect(plan.untrustedDays[0]).toMatchObject({
      kcal: 122,
      trust: "incomplete",
      counts: false,
      needsAnswer: true,
    });
  });

  it("reacts to an overshoot even when an earlier day was never logged", () => {
    // Before the trust pass, an unlogged Monday donated a phantom 2000 kcal of
    // unspent allowance, which swallowed Tuesday's overshoot whole and left
    // the plan looking untouched -- the "I never see it do anything" bug.
    const plan = computeAdaptivePlan({
      weekLogs: [log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.spentBeforeToday).toBe(5000);
    expect(plan.adaptiveDailyTarget).toBe(1800);
    expect(plan.trimmedKcal).toBe(200);
    expect(plan.isAdjusted).toBe(true);
  });

  it("lets the user's own answer beat the heuristic", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 122)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 2000,
      dayAnswers: new Map([["2026-01-06", "complete"]]),
      now: WED,
    });
    expect(plan.spentBeforeToday).toBe(3122); // 122 taken at face value
    expect(plan.untrustedDays).toHaveLength(0);
  });

  it("stops asking once the user says the day was not fully logged", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 122)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 2000,
      dayAnswers: new Map([["2026-01-06", "partial"]]),
      now: WED,
    });
    expect(plan.spentBeforeToday).toBe(5000); // still neutralized
    expect(plan.untrustedDays[0]?.needsAnswer).toBe(false);
  });

  it("never questions a day with nothing logged at all", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    const tuesday = plan.untrustedDays.find((d) => d.dayKey === "2026-01-06");
    expect(tuesday).toMatchObject({ trust: "empty", needsAnswer: false });
  });

  it("says nothing at all when the week is on track and fully logged", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 2000), log(TUE, 2000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.hasNotice).toBe(false);
  });

  it("reports the days still ahead so the note can look forward", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.daysAfterToday).toBe(4); // Thu..Sun
  });
});

describe("why the plan moved: the cause, the spill, and whether it deserves a screen", () => {
  it("names the day that caused it, with its signed deviation", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 2100), log(TUE, 3500)],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: WED,
    });
    // Monday is 900 under, Tuesday 500 over -- biggest deviation first.
    expect(plan.causeDays).toEqual([
      { dayKey: "2026-01-05", kcal: 2100, deltaKcal: -900 },
      { dayKey: "2026-01-06", kcal: 3500, deltaKcal: 500 },
    ]);
  });

  it("ignores deviations too small to be worth naming", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3020), log(TUE, 2990)],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: WED,
    });
    expect(plan.causeDays).toEqual([]);
  });

  it("never blames a day it refused to believe", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3500), log(TUE, 122)],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: WED,
    });
    expect(plan.causeDays.map((d) => d.dayKey)).toEqual(["2026-01-05"]);
  });

  it("reports what this week cannot absorb, across every remaining day", () => {
    // Huge Monday: the 25% trim cap holds each remaining day at 1500, so the
    // shortfall is per-day and must be multiplied by the days it applies to.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 9000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    // spent-before 9000 + 2000 (untrusted-free: Tue empty -> base) = 11000.
    // ideal = (14000 - 11000) / 5 = 600; cap floor 1500 -> 900 short per day.
    expect(plan.spillToNextWeekKcal).toBe(4500);
  });

  it("has no spill when food alone absorbs the overshoot", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.spillToNextWeekKcal).toBe(0);
  });

  it("calls a small early-week trim IMMATERIAL -- not worth a whole screen", () => {
    // The user's own example: 3500 instead of 3000 yesterday, six days left.
    // 500 spread over 6 days is 83 kcal/day; taking over the screen for that
    // is how a moment becomes an annoyance.
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3500)],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: TUE_NOW,
    });
    expect(plan.isAdjusted).toBe(true);
    expect(plan.trimmedKcal).toBe(83);
    expect(plan.isMaterial).toBe(false);
  });

  it("calls the SAME overshoot material once it lands on few enough days", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [
        log(MON, 3000),
        log(TUE, 3000),
        log(WED_LOG, 3000),
        log(THU_LOG, 3500),
      ],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: FRI,
    });
    // The identical 500 kcal overshoot now falls on three days instead of six:
    // 167/day, past the 150 (5% of 3000) line. Same event, different weight --
    // which is exactly why the threshold is on the DAILY change, not on the
    // size of the overshoot.
    expect(plan.trimmedKcal).toBe(167);
    expect(plan.isMaterial).toBe(true);
  });

  it("stays immaterial on Thursday, where the same overshoot is only 125/day", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 3000), log(TUE, 3000), log(WED_LOG, 3500)],
      baseDailyTarget: 3000,
      sex: "male",
      bmrKcal: 1900,
      now: THU,
    });
    expect(plan.trimmedKcal).toBe(125);
    expect(plan.isMaterial).toBe(false);
  });

  it("always treats an activity ask as material -- walking is not a footnote", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 9000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.trainingSuggestionKcal).toBeGreaterThan(0);
    expect(plan.isMaterial).toBe(true);
  });

  it("is never material when nothing moved", () => {
    const plan = computeAdaptivePlan({
      weekLogs: [log(MON, 2000), log(TUE, 2000)],
      baseDailyTarget: 2000,
      sex: "male",
      bmrKcal: 1600,
      now: WED,
    });
    expect(plan.isMaterial).toBe(false);
  });
});

describe("computeCarryInFromLastWeek: 1-week debt lookback", () => {
  // Last week relative to Wed 2026-01-07 is Mon 2025-12-29 .. Sun 2026-01-04.
  function lastWeek(kcalPerDay: number[]) {
    return kcalPerDay.map((kcal, index) =>
      log(
        new Date(Date.UTC(2025, 11, 29 + index, 12)).toISOString(),
        kcal
      )
    );
  }

  it("carries the amount last week went over budget", () => {
    // Six days at target plus a 4000 Saturday -> 16000 vs a 14000 budget.
    const carry = computeCarryInFromLastWeek(
      lastWeek([2000, 2000, 2000, 2000, 2000, 4000, 2000]),
      2000,
      { sex: "male", bmrKcal: 1600 }
    );
    expect(carry).toBe(2000);
  });

  it("carries nothing when last week was under budget", () => {
    const carry = computeCarryInFromLastWeek(
      lastWeek([1500, 1500, 1500, 1500, 1500, 1500, 1500]),
      2000,
      { sex: "male", bmrKcal: 1400 }
    );
    expect(carry).toBe(0);
  });

  it("invents no debt from a week that was never logged", () => {
    const carry = computeCarryInFromLastWeek([], 2000, {
      sex: "male",
      bmrKcal: 1600,
    });
    expect(carry).toBe(0);
  });

  it("still carries one genuine blowout from an otherwise unlogged week", () => {
    // Six unlogged days are assumed on plan; the logged 5000 day is 3000 over.
    const carry = computeCarryInFromLastWeek(
      [log("2026-01-03T12:00:00.000Z", 5000)],
      2000,
      { sex: "male", bmrKcal: 1600 }
    );
    expect(carry).toBe(3000);
  });

  it("ignores a day whose log is too small to be a whole day", () => {
    const carry = computeCarryInFromLastWeek(
      lastWeek([2000, 2000, 2000, 2000, 2000, 4000, 90]),
      2000,
      { sex: "male", bmrKcal: 1600 }
    );
    // The 90 kcal Sunday is charged at base, so the debt is still just the
    // Saturday overshoot -- not 90 kcal worth of fictional credit.
    expect(carry).toBe(2000);
  });
});
