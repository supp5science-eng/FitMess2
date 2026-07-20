/**
 * Adaptive daily target (2026-07-20 feature, "deo 2").
 *
 * When a user goes over their daily limit, the remaining days of the CURRENT
 * week (Mon..Sun, the app's existing weekly-budget frame) absorb the overshoot
 * so the week still lands on its budget -- "vraćanje na prag". Pure,
 * DB-free arithmetic (money-math rule), computed on the fly from this week's
 * logs; nothing is persisted.
 *
 * Model (all decisions confirmed with the product owner 2026-07-20):
 *  - Window: the rest of THIS week. remaining weekly allowance is spread evenly
 *    over the days left (including today).
 *  - Safety: the adjusted daily target is clamped to [floor, base] -- it never
 *    drops below the sex-specific kcal floor (no starving) and never rises
 *    ABOVE the base target (an under-eaten day is not turned into a licence to
 *    binge; only overshoots pull the target DOWN).
 *  - Overflow -> next week: whatever overshoot can't be absorbed within the
 *    floor this week is carried in as `carryInKcal` (computed by
 *    `computeCarryInFromLastWeek` from the immediately-previous week; a
 *    1-week lookback -- full multi-week compounding would need a persisted
 *    balance, deliberately out of scope for this on-the-fly version).
 *  - Training: the part that food genuinely cannot cover today (the daily need
 *    that falls below the floor) becomes an activity SUGGESTION, since the app
 *    has no workout-tracking system yet.
 */

import { KCAL_FLOOR } from "@/lib/budget/engine";
import { computeWeekSummary, type LogForWeek } from "@/lib/week/summary";
import type { Sex } from "@/lib/types/db";

/** Rough kcal burned per minute of brisk walking, for the activity hint. */
const BRISK_WALK_KCAL_PER_MIN = 5;

/** Round a kcal amount to the nearest 50 for a friendly, non-fake-precise hint. */
function roundTo50(value: number): number {
  return Math.round(value / 50) * 50;
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
  /** How much lower today's target is vs base (base - adaptive), >= 0. */
  trimmedKcal: number;
  /** Suggested activity kcal for the part food can't cover today (0 if none). */
  trainingSuggestionKcal: number;
  /** Rough brisk-walk minutes matching `trainingSuggestionKcal` (0 if none). */
  trainingWalkMinutes: number;
}

export interface AdaptivePlanInput {
  /** This week's logs (Belgrade Mon..now); days are bucketed internally. */
  weekLogs: LogForWeek[];
  /** targets.daily_kcal. */
  baseDailyTarget: number;
  /** The user's sex, for the safe kcal floor. */
  sex: Sex;
  /** Debt carried from the previous week (>= 0); default 0. */
  carryInKcal?: number;
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

  const spentBeforeToday = summary.days
    .filter((day) => day.weekdayIndex < todayIndex)
    .reduce((sum, day) => sum + day.kcal, 0);

  const remainingAllowance = summary.weeklyBudget - spentBeforeToday - carryIn;
  const idealDaily = remainingAllowance / daysLeft;

  // Clamp: never above base (no binge reward), never below the floor.
  const adaptive = Math.round(Math.min(base, Math.max(floor, idealDaily)));

  // The daily need that even the floor can't cover -> suggest activity.
  const belowFloor = floor - idealDaily;
  const trainingSuggestionKcal = belowFloor > 0 ? roundTo50(belowFloor) : 0;
  const trainingWalkMinutes =
    trainingSuggestionKcal > 0
      ? Math.max(
          5,
          Math.round(trainingSuggestionKcal / BRISK_WALK_KCAL_PER_MIN / 5) * 5
        )
      : 0;

  const trimmedKcal = Math.max(0, base - adaptive);
  const isAdjusted = trimmedKcal > 0 || trainingSuggestionKcal > 0;

  return {
    baseDailyTarget: base,
    adaptiveDailyTarget: adaptive,
    isAdjusted,
    weeklyBudget: summary.weeklyBudget,
    spentBeforeToday: Math.round(spentBeforeToday),
    daysLeftIncludingToday: daysLeft,
    carryInKcal: carryIn,
    trimmedKcal,
    trainingSuggestionKcal,
    trainingWalkMinutes,
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
  baseDailyTarget: number
): number {
  const base = Math.max(0, Math.round(baseDailyTarget));
  const budget = base * 7;
  const spent = lastWeekLogs.reduce((sum, log) => sum + log.kcal, 0);
  return Math.max(0, Math.round(spent - budget));
}
