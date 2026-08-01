/**
 * Adaptive daily target (2026-07-20 feature, "deo 2"; reworked 2026-07-25).
 *
 * When a user misses their daily limit, the remaining days of the CURRENT
 * week (Mon..Sun, the app's existing weekly-budget frame) absorb the difference
 * so the week still lands on its budget -- "vraćanje na prag". Pure,
 * DB-free arithmetic (money-math rule), computed on the fly from this week's
 * logs; nothing is persisted.
 *
 * Model:
 *  - Window: the rest of THIS week. The remaining weekly allowance is spread
 *    evenly over the days left (including today).
 *  - Floor: never below the sex-specific kcal floor (no starving).
 *  - Daily trim cap (2026-07-25): a single day is never cut by more than
 *    `MAX_DAILY_TRIM_PCT` of the base target, no matter how big the overshoot.
 *    Before this, a big Monday landing on a Sunday (1 day left) collapsed that
 *    day straight to the floor and produced an hour-and-a-half walk suggestion
 *    -- technically correct, practically ignored. Whatever the cap refuses to
 *    trim simply leaves the week over budget, which the EXISTING carry-in
 *    mechanism picks up next week; the spill needs no extra bookkeeping.
 *  - Direction depends on the GOAL (2026-07-25). Cutting goals (`lose`,
 *    `tone`) are one-way: an overshoot pulls the target DOWN, but under-eating
 *    never pushes it up -- eating less than planned on a cut is not a debt to
 *    repay. Goals that are about HITTING a number (`gain`, `maintain`) are
 *    symmetric: under-eating on a bulk is a missed target, so the remaining
 *    days rise (capped by `MAX_DAILY_LIFT_PCT`, so one skipped day cannot
 *    mandate an absurd feast). Before this, a bulking user who under-ate was
 *    silently told to keep eating the same amount, which works against the
 *    very goal they chose.
 *  - Activity: the part food genuinely cannot cover today becomes an activity
 *    suggestion, expressed BOTH as kcal and as a raised step goal
 *    (`adaptiveStepGoal`), so the note and the "Koraci" card say one thing
 *    instead of two unrelated things. Capped at
 *    `MAX_TRAINING_SUGGESTION_KCAL`; the rest rolls into next week like any
 *    other untrimmed overshoot.
 *  - Trust (2026-08-01): a past day only moves the plan if its log is
 *    PLAUSIBLE as a whole day's food (see `day-trust.ts`). Days we cannot
 *    vouch for are counted AS PLANNED -- base target, zero delta -- never as
 *    their logged number. Before this, a Tuesday holding one forgotten 122
 *    kcal entry was read as a 122 kcal day: on a cut that quietly did nothing,
 *    and on a bulk it ordered the user to eat back food they had already
 *    eaten. It also cuts the other way: an overshoot on Tuesday now moves the
 *    plan even when Monday was never logged, because Monday no longer donates
 *    a phantom 2000 kcal of unspent allowance to the rest of the week.
 */

import { KCAL_FLOOR } from "@/lib/budget/engine";
import {
  bucketDayIntake,
  classifyDay,
  plausibilityFloor,
  type DayAnswer,
  type DayVerdict,
} from "@/lib/home/day-trust";
import { FALLBACK_STEP_GOAL } from "@/lib/steps/step-goal";
import { computeWeekSummary, type LogForWeek } from "@/lib/week/summary";
import type { GoalType, Sex } from "@/lib/types/db";

/** Rough kcal burned per minute of brisk walking, for the activity hint. */
const BRISK_WALK_KCAL_PER_MIN = 5;

/** Rough steps per kcal of brisk walking (~100 steps/min at ~5 kcal/min). */
const STEPS_PER_KCAL = 20;

/**
 * The most a single day's target may be cut below base, as a fraction of base.
 * Mirrors `MAX_DEFICIT_PCT` in the budget engine: the app already refuses to
 * plan a deficit steeper than 25% of TDEE, so a redistribution that quietly
 * imposed a steeper one would contradict the plan it is protecting.
 */
export const MAX_DAILY_TRIM_PCT = 0.25;

/**
 * The most a single day's target may be raised above base (`gain`/`maintain`
 * only). Keeps "you under-ate on Monday" from turning Tuesday into a feast
 * nobody will actually eat.
 */
export const MAX_DAILY_LIFT_PCT = 0.2;

/**
 * Ceiling on the activity suggestion. ~250 kcal is a brisk 50-minute walk --
 * a real ask, still doable on a normal day. Anything beyond it is not "make it
 * up today", it is next week's problem, and pretending otherwise is how a
 * suggestion becomes noise.
 */
export const MAX_TRAINING_SUGGESTION_KCAL = 250;

/** Goals measured by HITTING a number rather than staying under one. */
const SYMMETRIC_GOALS: readonly GoalType[] = ["gain", "maintain"];

/** Round a kcal amount to the nearest 50 for a friendly, non-fake-precise hint. */
function roundTo50(value: number): number {
  return Math.round(value / 50) * 50;
}

/** Round a step count to the nearest 500 -- step goals are never precise. */
function roundTo500(value: number): number {
  return Math.round(value / 500) * 500;
}

export interface AdaptivePlan {
  /** The user's underlying daily target (targets.daily_kcal), whole kcal. */
  baseDailyTarget: number;
  /** Adjusted target for today/remaining days after redistribution + clamps. */
  adaptiveDailyTarget: number;
  /** True when the adjusted target differs from base OR an activity hint applies. */
  isAdjusted: boolean;
  /** This week's full budget: base * 7. */
  weeklyBudget: number;
  /** kcal already logged on the days BEFORE today this week. */
  spentBeforeToday: number;
  /** Days left in the week including today (1..7). */
  daysLeftIncludingToday: number;
  /** Debt carried in from the previous week (>= 0). */
  carryInKcal: number;
  /** How much LOWER today's target is vs base (base - adaptive), >= 0. */
  trimmedKcal: number;
  /** How much HIGHER today's target is vs base (adaptive - base), >= 0.
   * Only ever non-zero for `gain`/`maintain`. */
  liftedKcal: number;
  /** Suggested activity kcal for the part food can't cover today (0 if none). */
  trainingSuggestionKcal: number;
  /** Rough brisk-walk minutes matching `trainingSuggestionKcal` (0 if none). */
  trainingWalkMinutes: number;
  /** Today's step goal: the user's own goal, raised to cover the activity
   * suggestion. Equals the plain goal when no activity is needed. */
  adaptiveStepGoal: number;
  /** Extra steps above the default (0 when none) -- what the note announces. */
  extraSteps: number;
  /** Days AFTER today still left in the week (0..6) -- the note says what the
   * plan looks like going forward, not just today. */
  daysAfterToday: number;
  /**
   * Past days this week whose logs did NOT feed the math (see `day-trust.ts`),
   * newest last. Each was counted as a day ON PLAN instead. The card lists
   * them, and asks about the ambiguous ones (`needsAnswer`).
   */
  untrustedDays: DayVerdict[];
  /** True when the card has something to say: an adjustment, or a day to ask
   * about. A plan that is on track AND fully logged shows nothing. */
  hasNotice: boolean;
}

export interface AdaptivePlanInput {
  /** This week's logs (Belgrade Mon..now); days are bucketed internally. */
  weekLogs: LogForWeek[];
  /** targets.daily_kcal. */
  baseDailyTarget: number;
  /** The user's sex, for the safe kcal floor. */
  sex: Sex;
  /** The user's goal (targets.goal). Decides whether under-eating is corrected
   * upward. Missing/unknown is treated as a cutting goal (the safe default:
   * never tell someone to eat more on a guess). */
  goal?: GoalType | null;
  /**
   * The user's own daily step goal (see `src/lib/steps/step-goal.ts`) -- the
   * base the activity suggestion is added ON TOP of. Was a flat 10.000 for
   * everybody until 2026-07-25; passing the real goal is what keeps "prošetaj
   * još 3.000" from quietly assuming a target the user never agreed to.
   */
  baseStepGoal?: number;
  /** Debt carried from the previous week (>= 0); default 0. */
  carryInKcal?: number;
  /**
   * The user's BMR, the line below which a whole day's log is treated as
   * incomplete rather than as a real day (see `day-trust.ts`). Omitted (an
   * older profile without height/birth year) falls back to the sex floor.
   */
  bmrKcal?: number | null;
  /** The user's own verdicts on flagged days, keyed by Belgrade day; always
   * beats the heuristic. Comes from the `fm_dani` cookie. */
  dayAnswers?: Map<string, DayAnswer>;
  /** "Now" (injectable for tests); defaults to the real clock at the call. */
  now?: Date;
}

/**
 * Computes today's adaptive daily target from this week's logging so far.
 * Never throws; a non-positive base target degrades to a safe zero-ish plan.
 */
export function computeAdaptivePlan(input: AdaptivePlanInput): AdaptivePlan {
  const base = Math.max(0, Math.round(input.baseDailyTarget));
  const floor = Math.min(base, KCAL_FLOOR[input.sex] ?? KCAL_FLOOR.male);
  const carryIn = Math.max(0, Math.round(input.carryInKcal ?? 0));
  const now = input.now ?? new Date();

  const summary = computeWeekSummary(input.weekLogs, base, now);
  const todayIndex = summary.elapsedDays - 1; // 0 = Monday .. 6 = Sunday
  const daysLeft = Math.max(1, 7 - todayIndex);

  // Trust pass: a day before today is judged BEFORE it is allowed to move the
  // plan. An untrusted day is charged at `base` -- the neutral reading -- so
  // it neither invents a debt nor donates unspent allowance to the days after
  // it. See `day-trust.ts` for why absence of data must not read as data.
  const floorKcal = plausibilityFloor(input.bmrKcal, input.sex);
  const intake = bucketDayIntake(input.weekLogs);

  const verdicts = summary.days
    .filter((day) => day.weekdayIndex < todayIndex)
    .map((day) =>
      classifyDay(
        intake.get(day.dayKey) ?? { dayKey: day.dayKey, kcal: 0, logCount: 0 },
        floorKcal,
        input.dayAnswers?.get(day.dayKey) ?? null
      )
    );

  const spentBeforeToday = verdicts.reduce(
    (sum, day) => sum + (day.counts ? day.kcal : base),
    0
  );
  const untrustedDays = verdicts.filter((day) => !day.counts);

  const remainingAllowance = summary.weeklyBudget - spentBeforeToday - carryIn;
  const idealDaily = remainingAllowance / daysLeft;

  // Lower bound: the safety floor AND the daily trim cap, whichever binds
  // first. Never below the floor, never a steeper one-day cut than the plan
  // itself would ever prescribe.
  const trimCapFloor = base * (1 - MAX_DAILY_TRIM_PCT);
  const lowerBound = Math.max(floor, Math.min(base, trimCapFloor));

  // Upper bound: base for cutting goals (an under-eaten day is not a licence
  // to binge); a capped lift for goals that are about hitting a number.
  const allowsLift = SYMMETRIC_GOALS.includes(input.goal ?? "lose");
  const upperBound = allowsLift ? Math.round(base * (1 + MAX_DAILY_LIFT_PCT)) : base;

  const adaptive = Math.round(
    Math.min(upperBound, Math.max(lowerBound, idealDaily))
  );

  // What even the lower bound can't absorb today -> activity, capped. The
  // remainder is deliberately NOT chased: it leaves the week over budget and
  // returns as next week's carry-in.
  const uncovered = lowerBound - idealDaily;
  const trainingSuggestionKcal =
    uncovered > 0
      ? Math.min(MAX_TRAINING_SUGGESTION_KCAL, roundTo50(uncovered))
      : 0;
  const trainingWalkMinutes =
    trainingSuggestionKcal > 0
      ? Math.max(
          5,
          Math.round(trainingSuggestionKcal / BRISK_WALK_KCAL_PER_MIN / 5) * 5
        )
      : 0;

  // The same suggestion, expressed as the thing the home screen actually
  // shows a goal for. One number, two places -- not two numbers.
  const extraSteps =
    trainingSuggestionKcal > 0
      ? roundTo500(trainingSuggestionKcal * STEPS_PER_KCAL)
      : 0;

  const trimmedKcal = Math.max(0, base - adaptive);
  const liftedKcal = Math.max(0, adaptive - base);
  const isAdjusted =
    trimmedKcal > 0 || liftedKcal > 0 || trainingSuggestionKcal > 0;

  return {
    baseDailyTarget: base,
    adaptiveDailyTarget: adaptive,
    isAdjusted,
    weeklyBudget: summary.weeklyBudget,
    spentBeforeToday: Math.round(spentBeforeToday),
    daysLeftIncludingToday: daysLeft,
    carryInKcal: carryIn,
    trimmedKcal,
    liftedKcal,
    trainingSuggestionKcal,
    trainingWalkMinutes,
    adaptiveStepGoal: (input.baseStepGoal ?? FALLBACK_STEP_GOAL) + extraSteps,
    extraSteps,
    daysAfterToday: daysLeft - 1,
    untrustedDays,
    hasNotice: isAdjusted || untrustedDays.some((day) => day.needsAnswer),
  };
}

/**
 * Debt to carry into the current week from the immediately-previous week:
 * how much last week's logged total exceeded last week's budget (base * 7),
 * never negative. A 1-week lookback (see the module header): an under-eaten
 * previous week carries nothing, and older debt is not compounded here.
 */
export function computeCarryInFromLastWeek(
  lastWeekLogs: LogForWeek[],
  baseDailyTarget: number,
  options?: {
    sex?: Sex;
    bmrKcal?: number | null;
    dayAnswers?: Map<string, DayAnswer>;
  }
): number {
  const base = Math.max(0, Math.round(baseDailyTarget));
  const budget = base * 7;

  // Same trust rule as the in-week pass: only days we can vouch for are read
  // at their logged value; every other day of the seven is charged at base.
  // A week where the user logged nothing therefore carries NO debt, while a
  // week with one genuine 5000 kcal day carries exactly that day's excess --
  // instead of the old reading, where six unlogged days silently "paid for"
  // the one blowout and the debt vanished.
  const floorKcal = plausibilityFloor(options?.bmrKcal, options?.sex ?? "male");
  const intake = bucketDayIntake(lastWeekLogs);

  let spent = 0;
  let trustedDays = 0;
  for (const day of intake.values()) {
    const verdict = classifyDay(
      day,
      floorKcal,
      options?.dayAnswers?.get(day.dayKey) ?? null
    );
    if (verdict.counts) {
      spent += verdict.kcal;
      trustedDays += 1;
    }
  }
  spent += Math.max(0, 7 - trustedDays) * base;

  return Math.max(0, Math.round(spent - budget));
}
