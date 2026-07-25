/**
 * Navike (habits): the pure day-math behind check-offs and streaks.
 *
 * Pure, side-effect-free, framework-free (same shape as
 * `src/lib/budget/rules.ts` / `src/lib/week/summary.ts`): no network, no
 * database, no `new Date()` reads hidden inside — the caller passes today's
 * Belgrade day key in, so every result is reproducible in a test.
 *
 * Day keys are Belgrade calendar days (`"YYYY-MM-DD"`), the same convention
 * `logs` / `weigh_ins` / `water_intake` already use
 * (`src/lib/dates.ts` `toBelgradeCalendarDay`).
 */

/** One check-off row as read from `public.habit_checks`. */
export interface HabitCheckRow {
  habit_id: string;
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
}

/** How many days of history the habits screen reads and draws. */
export const HABIT_HISTORY_DAYS = 30;

/** How many recent days the per-habit dot row shows (fits a phone width). */
export const HABIT_DOTS_DAYS = 7;

/** Shift a `"YYYY-MM-DD"` key by whole days, staying in calendar space.
 *
 * Uses `Date.UTC` purely as calendar arithmetic (never as a timestamp): the
 * key is parsed as a UTC midnight, shifted, and re-formatted, so month and
 * leap-year boundaries are handled by the platform rather than by hand. No
 * timezone conversion happens here — that already happened when the key was
 * produced by `toBelgradeCalendarDay`.
 */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

/** The `count` most recent day keys ending at (and including) `endDayKey`,
 * oldest first — the x-axis of the little dot row. */
export function recentDayKeys(endDayKey: string, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(shiftDayKey(endDayKey, -offset));
  }
  return keys;
}

/** Group raw check rows into `habit_id -> Set(day)` for O(1) lookups. */
export function indexChecks(rows: HabitCheckRow[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const row of rows) {
    const days = index.get(row.habit_id) ?? new Set<string>();
    days.add(row.day);
    index.set(row.habit_id, days);
  }
  return index;
}

/**
 * Current streak: consecutive days ending today.
 *
 * Today counts only if it is actually checked, but an unchecked TODAY does
 * not break a streak that ran through yesterday — the day isn't over yet.
 * Someone with a 12-day run who opens the app in the morning should see 12,
 * not 0; anything else punishes them for being early. Missing yesterday,
 * however, does break it.
 */
export function currentStreak(days: Set<string>, todayKey: string): number {
  if (days.size === 0) return 0;

  // Start counting at today if it's done, otherwise at yesterday (the grace
  // day described above).
  let cursor = days.has(todayKey) ? todayKey : shiftDayKey(todayKey, -1);
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return streak;
}

/** How many of `windowDays` days ending today were checked — the honest
 * "how am I really doing" number next to the streak. */
export function checksInWindow(
  days: Set<string>,
  todayKey: string,
  windowDays: number
): number {
  let count = 0;
  for (const key of recentDayKeys(todayKey, windowDays)) {
    if (days.has(key)) count += 1;
  }
  return count;
}

/** A habit as the screen renders it: its own text plus everything derived
 * from the check history. */
export interface HabitProgress {
  id: string;
  textSr: string;
  enabled: boolean;
  /** Checked off today? */
  doneToday: boolean;
  /** Consecutive days ending today (see `currentStreak`). */
  streak: number;
  /** Checked days out of the last `HABIT_HISTORY_DAYS`. */
  doneInHistory: number;
  /** Oldest-first flags for the last `HABIT_DOTS_DAYS` days, for the dot row. */
  recentDays: { dayKey: string; done: boolean }[];
}

/** Definition side of a habit — `profiles.rules`' persisted shape. */
export interface HabitDefinition {
  id: string;
  textSr: string;
  enabled: boolean;
}

/**
 * Join the habit definitions (`profiles.rules`) with the check history
 * (`habit_checks`) into what the screen needs. Habits keep their defined
 * order; disabled ones are included too (the settings section still lists
 * them), so filtering is the caller's decision, not this function's.
 */
export function buildHabitProgress(
  habits: HabitDefinition[],
  rows: HabitCheckRow[],
  todayKey: string
): HabitProgress[] {
  const index = indexChecks(rows);

  return habits.map((habit) => {
    const days = index.get(habit.id) ?? new Set<string>();
    return {
      id: habit.id,
      textSr: habit.textSr,
      enabled: habit.enabled,
      doneToday: days.has(todayKey),
      streak: currentStreak(days, todayKey),
      doneInHistory: checksInWindow(days, todayKey, HABIT_HISTORY_DAYS),
      recentDays: recentDayKeys(todayKey, HABIT_DOTS_DAYS).map((dayKey) => ({
        dayKey,
        done: days.has(dayKey),
      })),
    };
  });
}

/** "2/3" progress for today across the habits the user actually tracks. */
export function todayProgress(habits: HabitProgress[]): {
  done: number;
  total: number;
} {
  const tracked = habits.filter((habit) => habit.enabled);
  return {
    done: tracked.filter((habit) => habit.doneToday).length,
    total: tracked.length,
  };
}
