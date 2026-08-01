/**
 * Trening: pure, DB-free arithmetic turning a week of workout rows into the
 * 7-day strip at the foot of the home card.
 *
 * Same "money-math rule" as `water-week.ts` / `steps-week.ts`: deterministic
 * code computes every number the card draws.
 *
 * ONE DELIBERATE DIFFERENCE from those two: there is no goal here, so the bars
 * are scaled against the WEEK'S OWN BUSIEST DAY, not against a target. Koraci
 * and Voda can say "you hit 80% of the goal"; training has no such number, and
 * inventing one ("train 5x a week!") would turn a record of what you did into a
 * quota you can fail -- the opposite of what this feature is for. So the strip
 * answers a comparative question instead: is today normal FOR YOU?
 *
 * A week with no training at all yields all-zero bars rather than an empty
 * strip, so the card keeps its shape on a rest week.
 */

import { toBelgradeCalendarDay } from "@/lib/dates";
import { WEEKDAY_LABELS_SR } from "@/lib/week/summary";

const WINDOW_DAYS = 7;

/** Minimal workout row shape this module needs (a `workouts` subset). */
export interface WorkoutDayInput {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  kcal: number;
  minutes: number;
}

export interface WorkoutDay {
  dayKey: string;
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  kcal: number;
  minutes: number;
  isToday: boolean;
  /** This day against the week's busiest day, 0..1. */
  pct: number;
}

export interface WorkoutWeek {
  /** 7 days, oldest → the day being viewed. */
  days: WorkoutDay[];
  todayKcal: number;
  todayMinutes: number;
  /** kcal on the week's busiest day (the strip's scale); 0 on a rest week. */
  maxKcal: number;
  /** Days this week with at least one session. */
  activeDaysCount: number;
}

/**
 * Builds the 7-day window ending on `now`'s Belgrade day.
 *
 * `rows` may hold several sessions per day (the table is one row per session),
 * so days are summed here rather than assumed unique -- the one thing that
 * would silently under-report a double-session day.
 */
export function computeWorkoutWeek(
  rows: WorkoutDayInput[],
  now: Date = new Date()
): WorkoutWeek {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);

  const totals = new Map<string, { kcal: number; minutes: number }>();
  for (const row of rows) {
    const current = totals.get(row.day) ?? { kcal: 0, minutes: 0 };
    totals.set(row.day, {
      kcal: current.kcal + Math.max(0, row.kcal),
      minutes: current.minutes + Math.max(0, row.minutes),
    });
  }

  const days: WorkoutDay[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year!, month! - 1, day! - offset));
    const dayKey = toBelgradeCalendarDay(date);
    const total = totals.get(dayKey) ?? { kcal: 0, minutes: 0 };

    days.push({
      dayKey,
      // `getUTCDay()` is 0=Sun..6=Sat; the Serbian labels start at Monday.
      label: WEEKDAY_LABELS_SR[(date.getUTCDay() + 6) % 7]!,
      kcal: total.kcal,
      minutes: total.minutes,
      isToday: dayKey === todayKey,
      pct: 0,
    });
  }

  const maxKcal = days.reduce((max, entry) => Math.max(max, entry.kcal), 0);
  for (const entry of days) {
    entry.pct = maxKcal > 0 ? entry.kcal / maxKcal : 0;
  }

  const today = days[days.length - 1]!;
  return {
    days,
    todayKcal: today.kcal,
    todayMinutes: today.minutes,
    maxKcal,
    activeDaysCount: days.filter((entry) => entry.kcal > 0).length,
  };
}
