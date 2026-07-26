/**
 * Nagrade: how many days in a row end as a "pun dan" (three logged meals).
 *
 * Pure and DB-free like the rest of the app's arithmetic — the caller hands
 * over the award days it read and today's Belgrade key, this counts. Nothing
 * about a streak is STORED: it is always derived from the `awards` rows, so a
 * deleted or backfilled award can never leave a stale counter behind.
 *
 * The one rule worth stating out loud is what happens mid-day, before today's
 * third meal: a user with awards on Mon/Tue/Wed opening the app on Thursday
 * morning has a streak of 3, not 0. A streak only breaks when a whole day goes
 * by WITHOUT the award, so the count is allowed to start at yesterday. It ends
 * there too — Friday morning, with nothing on Thursday, that same user is at 0.
 */

/** `"2026-07-26"` -> the day before it, `"2026-07-25"`. UTC-based so it is
 * plain calendar arithmetic with no timezone shifting the answer; the keys are
 * already Belgrade days by the time they get here. */
export function previousDayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export interface StreakResult {
  /** Consecutive award days ending today or yesterday; 0 when broken. */
  days: number;
  /** Whether today itself is already earned. */
  earnedToday: boolean;
}

/**
 * Counts the current run of consecutive award days.
 *
 * `awardDays` may be in any order and may contain duplicates — it is the raw
 * `day` column of the user's `awards` rows.
 */
export function currentStreak(
  awardDays: readonly string[],
  todayKey: string
): StreakResult {
  const earned = new Set(awardDays);
  const earnedToday = earned.has(todayKey);

  // Start at today when it is earned, otherwise at yesterday — see the header:
  // a day is only "missed" once it is over.
  let cursor = earnedToday ? todayKey : previousDayKey(todayKey);
  let days = 0;

  while (earned.has(cursor)) {
    days += 1;
    cursor = previousDayKey(cursor);
  }

  return { days, earnedToday };
}

/** How many logged meals earn the day. */
export const MEALS_FOR_FULL_DAY = 3;

/** The award every full day grants. One string, used by the grant, the push,
 * and the reward screen, so they cannot drift. */
export const FULL_DAY_AWARD = "pun-dan";

/**
 * The milestone copy for a streak length — what the reward screen crowns the
 * number with. Deliberately sparse: most days say nothing special, so the days
 * that DO feel earned.
 */
export function streakMilestone(days: number): string | null {
  if (days >= 100) return "100 dana. Ovo više nije navika, ovo si ti.";
  if (days >= 30) return "Mesec dana zaredom.";
  if (days >= 14) return "Dve nedelje bez preskakanja.";
  if (days >= 7) return "Nedelju dana zaredom!";
  if (days >= 3) return "Tri dana zaredom.";
  return null;
}
