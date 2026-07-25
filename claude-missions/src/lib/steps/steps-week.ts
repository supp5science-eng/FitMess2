/**
 * Analitika "Koraci" card: pure, DB-free arithmetic that turns a week of daily
 * step rows into per-day figures + a today-vs-goal summary.
 *
 * Same "money-math rule" as the rest of the app: deterministic code computes
 * every number the card draws; the component only maps the domain onto pixels
 * and owns the (interactive) day selection.
 *
 * Steps are self-reported (no pedometer in a PWA), so there is no per-user goal
 * field yet -- we use the classic 10 000/day target.
 */

import { analyticsDayLabel } from "@/lib/analytics/day-label";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { WEEKDAY_LABELS_SR } from "@/lib/week/summary";

const WINDOW_DAYS = 7;

/** The classic daily step goal. */
export const DEFAULT_STEP_GOAL = 10000;

/** Minimal step row shape this module needs (a `step_counts` subset). */
export interface StepsDayInput {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  steps: number;
}

export interface StepsDay {
  dayKey: string;
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  /** Friendly long label for the tap read-out: "Danas" / "Juče" / "Sreda, 22.
   * jul" (shared across every Analitika chart, see `analyticsDayLabel`). */
  longLabel: string;
  steps: number;
  isToday: boolean;
  /** True once this day met the goal. */
  reached: boolean;
  /** Steps vs goal, 0..1. */
  pct: number;
}

export interface StepsWeek {
  /** 7 days, oldest → today. */
  days: StepsDay[];
  goalSteps: number;
  todaySteps: number;
  /** Mean steps across days WITH any steps this week; 0 if none. */
  weekAvgSteps: number;
  /** How many of the 7 days met the goal (the "streak"-ish stat). */
  goalDaysCount: number;
  /** Chart scale: max(goal, tallest day) so the goal line always fits. */
  maxSteps: number;
  loggedDaysCount: number;
}

/** `12345` → `"12.345"` (Serbian thousands grouping). */
export function formatSteps(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("sr-RS");
}

function shiftDayKey(todayKey: string, deltaDays: number): string {
  const [year, month, day] = todayKey.split("-").map(Number);
  return toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! + deltaDays))
  );
}

/**
 * Buckets the last 7 days of step rows into a fully-derived `StepsWeek`.
 * `now` defaults to the current instant; pass it for deterministic tests.
 */
export function computeStepsWeek(
  rows: StepsDayInput[],
  now: Date,
  goalSteps: number = DEFAULT_STEP_GOAL
): StepsWeek {
  const todayKey = toBelgradeCalendarDay(now);
  const dayKeys = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    shiftDayKey(todayKey, -(WINDOW_DAYS - 1) + i)
  );

  const byDay = new Map(
    rows.map((r) => [r.day, Math.max(0, Math.round(r.steps))] as const)
  );

  const days: StepsDay[] = dayKeys.map((dayKey) => {
    const steps = byDay.get(dayKey) ?? 0;
    return {
      dayKey,
      label: WEEKDAY_LABELS_SR[weekdayIndex(dayKey)]!,
      longLabel: analyticsDayLabel(dayKey, now),
      steps,
      isToday: dayKey === todayKey,
      reached: steps >= goalSteps,
      pct: goalSteps > 0 ? Math.min(1, steps / goalSteps) : 0,
    };
  });

  const logged = days.filter((d) => d.steps > 0);
  const weekAvgSteps =
    logged.length > 0
      ? Math.round(logged.reduce((s, d) => s + d.steps, 0) / logged.length)
      : 0;

  return {
    days,
    goalSteps,
    todaySteps: days[WINDOW_DAYS - 1]!.steps,
    weekAvgSteps,
    goalDaysCount: days.filter((d) => d.reached).length,
    maxSteps: Math.max(goalSteps, ...days.map((d) => d.steps)),
    loggedDaysCount: logged.length,
  };
}

/** Monday=0..Sunday=6 index of a `"YYYY-MM-DD"` calendar day. */
function weekdayIndex(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay(); // Sun=0
  return (jsDay + 6) % 7;
}
