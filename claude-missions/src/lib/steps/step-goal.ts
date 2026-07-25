/**
 * Cilj koraka: where a user's daily step goal actually comes from.
 *
 * Until 2026-07-25 every user was measured against a flat 10.000. That number
 * is not medicine -- it is marketing: the 1965 Yamasa pedometer sold in Japan
 * as "manpo-kei" ("10.000-step meter"), and the figure stuck. The research that
 * followed (Lee et al., JAMA Intern Med 2019; Paluch et al., Lancet Public
 * Health 2022) finds the mortality benefit climbing steeply up to roughly
 * 6.000-8.000 steps a day and then flattening out. A sedentary office worker
 * measured against 10.000 fails every single day, and a goal you always fail is
 * not a goal -- it is a reason to stop looking at the card.
 *
 * So the goal is now derived from what the app already knows about the person
 * (their onboarding activity level), and the user can override it outright.
 * Pure, DB-free arithmetic (money-math rule); the DB only stores the override.
 */

import type { ActivityLevel } from "@/lib/types/db";

/** Hard bounds on any stored goal -- also enforced by the DB check constraint. */
export const MIN_STEP_GOAL = 2000;
export const MAX_STEP_GOAL = 30000;

/** Custom goals are picked (and rounded) in 500-step increments. */
export const STEP_GOAL_INCREMENT = 500;

/**
 * The automatic goal per onboarding activity level.
 *
 * Anchored on the ~7.000-8.000 plateau rather than on 10.000: a sedentary
 * person is asked for a reachable step up from where they are, someone who
 * already trains 6-7x a week gets a target that isn't trivially met. These are
 * daily TOTALS (everything you walk), not "exercise steps".
 */
export const STEP_GOAL_BY_ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 5000,
  light: 6500,
  moderate: 8000,
  active: 9500,
  very_active: 11000,
};

/**
 * Fallback when the profile has no activity level yet (mid-onboarding, or an
 * older row). Deliberately the middle of the range, not 10.000.
 */
export const FALLBACK_STEP_GOAL = 7000;

/** How the effective goal was arrived at -- the UI explains itself with this. */
export type StepGoalSource = "custom" | "activity" | "fallback";

export interface ResolvedStepGoal {
  goal: number;
  source: StepGoalSource;
  /** The automatic goal, even when a custom one is in force -- so the settings
   * screen can offer "vrati na automatski" and say what that would be. */
  automaticGoal: number;
}

/** The automatic (activity-derived) goal, ignoring any override. */
export function automaticStepGoal(
  activityLevel: ActivityLevel | null | undefined
): number {
  if (!activityLevel) return FALLBACK_STEP_GOAL;
  return STEP_GOAL_BY_ACTIVITY[activityLevel] ?? FALLBACK_STEP_GOAL;
}

/**
 * The goal to measure a day against: the user's own if they set one, otherwise
 * the activity-derived default. A stored goal outside the allowed bounds (bad
 * data, a changed constraint) is clamped rather than trusted.
 */
export function resolveStepGoal(
  activityLevel: ActivityLevel | null | undefined,
  customGoal: number | null | undefined
): ResolvedStepGoal {
  const automaticGoal = automaticStepGoal(activityLevel);

  if (customGoal != null && Number.isFinite(customGoal)) {
    return {
      goal: clampStepGoal(customGoal),
      source: "custom",
      automaticGoal,
    };
  }

  return {
    goal: automaticGoal,
    source: activityLevel ? "activity" : "fallback",
    automaticGoal,
  };
}

/** Clamp + round a candidate goal onto the allowed grid. */
export function clampStepGoal(value: number): number {
  const rounded =
    Math.round(value / STEP_GOAL_INCREMENT) * STEP_GOAL_INCREMENT;
  return Math.min(MAX_STEP_GOAL, Math.max(MIN_STEP_GOAL, rounded));
}

/** Every value the custom-goal picker offers. */
export function stepGoalOptions(): number[] {
  const options: number[] = [];
  for (
    let value = MIN_STEP_GOAL;
    value <= MAX_STEP_GOAL;
    value += STEP_GOAL_INCREMENT
  ) {
    options.push(value);
  }
  return options;
}

export interface StepGoalSuggestion {
  /** Mean steps across the days that actually have a figure. */
  averageSteps: number;
  /** How many days that average is based on. */
  basedOnDays: number;
  /** A goal just above that average, on the 500 grid. */
  suggestedGoal: number;
}

/**
 * Minimum days with steps before the app is willing to say "your average is X".
 * Two walks do not describe a habit.
 */
export const MIN_DAYS_FOR_SUGGESTION = 4;

/**
 * Turns the user's own recent step days into a suggested goal: their average,
 * nudged up ~10%, on the 500 grid. Returns null when there isn't enough data --
 * the settings screen then simply doesn't offer the shortcut instead of making
 * up a number from two days.
 *
 * Deliberately only ever OFFERED, never applied automatically: a goal that
 * silently follows your average down stops being a goal.
 */
export function suggestStepGoalFromHistory(
  dailySteps: readonly number[]
): StepGoalSuggestion | null {
  const days = dailySteps.filter((steps) => Number.isFinite(steps) && steps > 0);
  if (days.length < MIN_DAYS_FOR_SUGGESTION) return null;

  const averageSteps = Math.round(
    days.reduce((sum, steps) => sum + steps, 0) / days.length
  );

  return {
    averageSteps,
    basedOnDays: days.length,
    suggestedGoal: clampStepGoal(averageSteps * 1.1),
  };
}
