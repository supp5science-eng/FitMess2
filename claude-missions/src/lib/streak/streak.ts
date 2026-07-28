/**
 * Niz (streak): how many Belgrade calendar days IN A ROW the user has logged
 * at least one meal on.
 *
 * Pure, side-effect-free, framework-free arithmetic -- the same "money-math"
 * shape as `src/lib/week/summary.ts` / `src/lib/awards/streak.ts`: no network,
 * no database, no `new Date()` hidden inside. The caller reads the logged-day
 * keys and passes today's Belgrade key in, so every result is reproducible in
 * a test. Nothing about a streak is STORED -- it is always DERIVED from the
 * `logs` rows, so a deleted or back-dated meal can never leave a stale counter
 * behind.
 *
 * A "streak day" is any Belgrade calendar day with >= 1 logged meal (the
 * product owner's clarified definition -- not the stricter three-meal "pun
 * dan" the `awards` streak counts). Day keys are Belgrade calendar days
 * (`"YYYY-MM-DD"`), the same convention `logs` already uses
 * (`src/lib/dates.ts` `toBelgradeCalendarDay`).
 *
 * The GRACE RULE (also clarified with the product owner): a run that reached
 * yesterday is NOT broken by a today that hasn't been logged yet -- the day
 * isn't over. Someone with a 12-day run who opens the app in the morning sees
 * 12, not 0; anything else punishes them for being early, which the app's
 * zero-shame tone forbids. The streak only breaks once a WHOLE day passes with
 * nothing logged. Missing YESTERDAY, however, does break it.
 */

import { serbianNumberForm } from "@/lib/log/units-sr";

/** Milestone lengths the card celebrates and fills its ring toward. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;

/** How many recent days the little dot row shows (a week -- the app's
 * established analytics window). */
export const STREAK_DOTS = 7;

/**
 * Shift a `"YYYY-MM-DD"` key by whole days, staying in calendar space.
 *
 * Uses `Date.UTC` purely as calendar arithmetic (never as a timestamp): the
 * key is parsed as a UTC midnight, shifted, and re-formatted, so month and
 * leap-year boundaries are handled by the platform rather than by hand. No
 * timezone conversion happens here -- that already happened when the key was
 * produced by `toBelgradeCalendarDay`.
 */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

/** The `count` most recent day keys ending at (and including) `endDayKey`,
 * oldest first -- the x-axis of the little dot row. */
export function recentDayKeys(endDayKey: string, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(shiftDayKey(endDayKey, -offset));
  }
  return keys;
}

/**
 * Current streak: consecutive logged days ending today (or, under the grace
 * rule, yesterday).
 *
 * Today counts only if it is actually logged, but an unlogged TODAY does not
 * break a streak that ran through yesterday -- the day isn't over yet.
 */
export function currentStreak(
  loggedDays: ReadonlySet<string>,
  todayKey: string
): number {
  if (loggedDays.size === 0) return 0;

  // Start counting at today if it's logged, otherwise at yesterday (the grace
  // day described in the header).
  let cursor = loggedDays.has(todayKey)
    ? todayKey
    : shiftDayKey(todayKey, -1);
  let streak = 0;

  while (loggedDays.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return streak;
}

/**
 * The longest run of consecutive logged days anywhere in `loggedDays` -- the
 * user's personal record ("najduži niz"). Scans the sorted unique keys once;
 * ISO `"YYYY-MM-DD"` keys sort chronologically as plain strings.
 */
export function longestStreak(loggedDays: ReadonlySet<string>): number {
  if (loggedDays.size === 0) return 0;

  const sorted = [...loggedDays].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = sorted[i] === shiftDayKey(sorted[i - 1]!, 1) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Whether `current` lands exactly on a milestone -- true only on the day the
 * run first reaches 3, 7, 14, ... (what the card celebrates with a crown). */
export function isMilestone(current: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(current);
}

/** The next milestone strictly beyond `current`, or `null` once every
 * milestone is behind the user. */
export function nextMilestone(current: number): number | null {
  for (const milestone of STREAK_MILESTONES) {
    if (milestone > current) return milestone;
  }
  return null;
}

/**
 * How full the milestone ring is: progress from the last milestone reached
 * toward the next one, 0..1. Resets to 0 the moment a milestone is hit (a
 * fresh goal to climb), then fills as the run grows. A run past every
 * milestone reads as a full ring.
 */
export function milestoneProgress(current: number): number {
  const next = nextMilestone(current);
  if (next === null) return 1;

  let prev = 0;
  for (const milestone of STREAK_MILESTONES) {
    if (milestone <= current) prev = milestone;
    else break;
  }

  const span = next - prev;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (current - prev) / span));
}

/**
 * The milestone copy for a streak length -- what the card crowns the number
 * with. Deliberately sparse: most lengths say nothing special, so the ones
 * that DO feel earned. sr-Latn, informal, zero-shame.
 */
export function streakMilestone(current: number): string | null {
  if (current >= 365) return "Godinu dana. Ovo si sada ti.";
  if (current >= 180) return "Pola godine bez preskakanja.";
  if (current >= 100) return "Sto dana zaredom.";
  if (current >= 60) return "Dva meseca u nizu.";
  if (current >= 30) return "Mesec dana zaredom!";
  if (current >= 14) return "Dve nedelje u nizu.";
  if (current >= 7) return "Nedelju dana zaredom!";
  if (current >= 3) return "Tri dana u nizu.";
  return null;
}

/** The noun "dan" in the form Serbian numeral agreement calls for -- "1 dan",
 * "2 dana", "5 dana", "21 dan". */
export function dayNounSr(count: number): string {
  return serbianNumberForm(count) === "one" ? "dan" : "dana";
}

/** `5` -> `"5 dana"`, `1` -> `"1 dan"`, `21` -> `"21 dan"`. */
export function dayCountSr(count: number): string {
  return `${count} ${dayNounSr(count)}`;
}

/** One recent day as the dot row renders it. */
export interface StreakDay {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Did the user log at least one meal that day? */
  logged: boolean;
  /** Is this today (the trailing dot)? */
  isToday: boolean;
}

/** Everything the streak UI needs, derived from the logged-day keys. */
export interface StreakSummary {
  /** Consecutive logged days ending today/yesterday; 0 when broken. */
  current: number;
  /** Longest run ever seen in the read window -- the personal record. */
  best: number;
  /** Whether today itself already has a logged meal. */
  loggedToday: boolean;
  /** The next milestone to chase, or `null` past the last one. */
  nextMilestone: number | null;
  /** Days from `current` to `nextMilestone`, or `null` past the last one. */
  daysToNext: number | null;
  /** How full the milestone ring is (0..1). */
  progressToNext: number;
  /** The current milestone copy, or `null` between milestones. */
  milestone: string | null;
  /** Oldest-first flags for the last `dotsCount` days -- the dot row. */
  recentDays: StreakDay[];
}

/**
 * Derive the whole streak summary from the raw logged-day keys.
 *
 * `loggedDayKeys` may be in any order and may contain duplicates -- it is the
 * set of Belgrade calendar days the user logged a meal on (see
 * `src/lib/streak/read-streak.ts`).
 */
export function computeStreak(
  loggedDayKeys: readonly string[],
  todayKey: string,
  dotsCount: number = STREAK_DOTS
): StreakSummary {
  const loggedDays = new Set(loggedDayKeys);
  const current = currentStreak(loggedDays, todayKey);
  const next = nextMilestone(current);

  return {
    current,
    best: Math.max(longestStreak(loggedDays), current),
    loggedToday: loggedDays.has(todayKey),
    nextMilestone: next,
    daysToNext: next === null ? null : next - current,
    progressToNext: milestoneProgress(current),
    milestone: streakMilestone(current),
    recentDays: recentDayKeys(todayKey, dotsCount).map((dayKey) => ({
      dayKey,
      logged: loggedDays.has(dayKey),
      isToday: dayKey === todayKey,
    })),
  };
}
