/**
 * F040/F041: pure, DB-free arithmetic for the weekly dashboard (`/nedelja`).
 *
 * Same "money-math rule" posture as `src/lib/home/totals.ts` and
 * `src/lib/budget/engine.ts`: deterministic code computes every number the
 * weekly screen shows -- per-day kcal buckets, the weekly spent total, the
 * daily average, and the on-track status -- nothing is eyeballed in a
 * component. Takes the week's logs (each carrying a `logged_at` timestamptz
 * and a `kcal`), the user's daily target, and "now", and returns a fully
 * derived `WeekSummary` the page renders directly.
 *
 * The week is Monday..Sunday in Europe/Belgrade (see `src/lib/dates.ts`);
 * "one bad day looks small against the whole week" is the philosophy, so the
 * dashboard's headline unit is the week, but the fair mid-week signal is the
 * DAILY AVERAGE across elapsed days (a full weekly budget always looks green
 * on Monday), which is what `status` is derived from.
 */

import {
  belgradeWeekDayKeys,
  belgradeWeekStartDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";

/** Short Serbian weekday labels, Monday..Sunday, aligned with `days` order. */
export const WEEKDAY_LABELS_SR = [
  "Pon",
  "Uto",
  "Sre",
  "Čet",
  "Pet",
  "Sub",
  "Ned",
] as const;

/** On-track status vs the daily target. Green = at/under, yellow = slight
 * overshoot (≤105%), red = over (>105%). Deliberately calm: never punitive
 * copy, just a color signal (see the dashboard component). */
export type WeekStatus = "green" | "yellow" | "red";

export interface LogForWeek {
  logged_at: string;
  kcal: number;
}

export interface DaySummary {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** 0 = Monday ... 6 = Sunday. */
  weekdayIndex: number;
  /** Short Serbian label, e.g. "Pon". */
  label: string;
  /** Total kcal logged that day (whole number). */
  kcal: number;
  /** True if at least one log landed on this day. */
  logged: boolean;
  /** True if this is today's day. */
  isToday: boolean;
  /** True if the day is still in the future (this week, not yet reached). */
  isFuture: boolean;
}

export interface WeekSummary {
  /** Exactly 7 entries, Monday..Sunday. */
  days: DaySummary[];
  /** The daily kcal target this week's budget is built from. */
  dailyTarget: number;
  /** Full-week budget: `dailyTarget * 7` (whole number). */
  weeklyBudget: number;
  /** Total kcal logged so far this week (whole number). */
  spentKcal: number;
  /** kcal left in the weekly budget; 0 once the budget is used up. */
  remainingKcal: number;
  /** kcal spent beyond the weekly budget; 0 while under. */
  overshootKcal: number;
  /** True once the weekly budget is met or exceeded. */
  isOver: boolean;
  /** Days elapsed in the week including today (1..7). */
  elapsedDays: number;
  /** Number of days with at least one log this week. */
  loggedDaysCount: number;
  /** Mean kcal/day across ELAPSED days (whole number); 0 before any day. */
  dailyAverage: number;
  /** On-track signal derived from `dailyAverage` vs `dailyTarget`. */
  status: WeekStatus;
}

/** Yellow band ceiling: up to +5% over the daily target is still "close". */
const YELLOW_CEILING = 1.05;

/**
 * Buckets a week of logs into a fully-derived `WeekSummary`.
 *
 * `logs` may contain rows from any day of the Belgrade week `now` falls in
 * (the caller queries the week range); rows outside the 7 Mon..Sun day keys
 * are ignored defensively. `dailyTarget <= 0` (no target yet) yields a
 * green, zero-budget summary rather than throwing -- the page shows its
 * "no target" state instead of calling this, but this must never crash.
 */
export function computeWeekSummary(
  logs: LogForWeek[],
  dailyTarget: number,
  now: Date = new Date()
): WeekSummary {
  const safeTarget = Math.max(0, Math.round(dailyTarget));
  const dayKeys = belgradeWeekDayKeys(now);
  const todayKey = toBelgradeCalendarDay(now);
  const weekStartKey = belgradeWeekStartDay(now);

  // elapsedDays: how many Mon..Sun slots are today-or-earlier. `todayKey` is
  // always one of the 7 keys when `now` is inside the week; find its index.
  const todayIndex = dayKeys.indexOf(todayKey);
  const elapsedDays = todayIndex >= 0 ? todayIndex + 1 : 7;

  const perDayKcal = new Map<string, number>();
  for (const log of logs) {
    const key = toBelgradeCalendarDay(new Date(log.logged_at));
    perDayKcal.set(key, (perDayKcal.get(key) ?? 0) + log.kcal);
  }

  const days: DaySummary[] = dayKeys.map((dayKey, weekdayIndex) => {
    const kcal = Math.round(perDayKcal.get(dayKey) ?? 0);
    return {
      dayKey,
      weekdayIndex,
      label: WEEKDAY_LABELS_SR[weekdayIndex]!,
      kcal,
      logged: perDayKcal.has(dayKey),
      isToday: dayKey === todayKey,
      isFuture: weekdayIndex > todayIndex && weekStartKey <= todayKey,
    };
  });

  const spentKcal = Math.round(
    days.reduce((sum, day) => sum + day.kcal, 0)
  );
  const weeklyBudget = safeTarget * 7;
  const remaining = weeklyBudget - spentKcal;
  const isOver = remaining < 0;

  const loggedDaysCount = days.filter((day) => day.logged).length;
  const dailyAverage =
    elapsedDays > 0 ? Math.round(spentKcal / elapsedDays) : 0;

  let status: WeekStatus = "green";
  if (safeTarget > 0 && loggedDaysCount > 0) {
    if (dailyAverage > safeTarget * YELLOW_CEILING) {
      status = "red";
    } else if (dailyAverage > safeTarget) {
      status = "yellow";
    }
  }

  return {
    days,
    dailyTarget: safeTarget,
    weeklyBudget,
    spentKcal,
    remainingKcal: isOver ? 0 : remaining,
    overshootKcal: isOver ? -remaining : 0,
    isOver,
    elapsedDays,
    loggedDaysCount,
    dailyAverage,
    status,
  };
}
