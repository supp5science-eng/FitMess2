/**
 * Podsetnici: WHEN this particular person usually eats, and which meal is
 * missing right now.
 *
 * The reminder this replaces was a fixed "upiši doručak" at 10:00 for
 * everybody, every day, whether or not they had already logged. It is the
 * reason the app's notifications were worth ignoring: a reminder that arrives
 * at the same minute regardless of what you did is not a reminder, it is a
 * clock. Someone who eats breakfast at 07:00 got it three hours late; someone
 * who never eats breakfast got it 365 times.
 *
 * So the schedule comes from the user's own history: the median time they
 * logged each meal over the past two weeks. Median rather than mean because one
 * midnight entry (a meal written down late) must not drag the whole estimate;
 * with 14 days of data the middle value is stable and the outlier is simply not
 * the middle.
 *
 * Pure and DB-free, like `due.ts` next to it — the sender gathers the rows and
 * the current instant, this decides. Everything is minutes since Belgrade
 * midnight.
 */

/** The three meals the day is divided into. Not a nutritional claim — just the
 * granularity at which "you haven't logged" is a useful thing to say. */
export type MealSlot = "breakfast" | "lunch" | "dinner";

export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];

/**
 * Which slot a log at `minutes` belongs to.
 *
 * The boundaries are deliberately wide and the night belongs to dinner: a meal
 * logged at 00:30 is almost always last night's dinner written down late, not
 * tomorrow's breakfast.
 */
export function slotOf(minutes: number): MealSlot {
  if (minutes >= 4 * 60 && minutes < 11 * 60) return "breakfast";
  if (minutes >= 11 * 60 && minutes < 17 * 60) return "lunch";
  return "dinner";
}

/** What we assume before the user has enough history to have a rhythm. */
export const DEFAULT_USUAL_MINUTES: Record<MealSlot, number> = {
  breakfast: 9 * 60,
  lunch: 13 * 60 + 30,
  dinner: 20 * 60,
};

/** Days of history a slot needs before its median is trusted over the default.
 * Two entries can be a coincidence; three is a habit. */
export const MIN_DAYS_FOR_RHYTHM = 3;

/** How long after the usual time we wait before saying anything. Someone who
 * eats at 13:00 and logs at 13:20 must never see a reminder. */
export const GRACE_MINUTES = 45;

/**
 * How long after the usual time the slot stops being worth mentioning.
 *
 * A "log your breakfast" at 16:00 is not a reminder, it is a comment on your
 * morning — and the meal after it is already the more useful thing to ask
 * about. Past this the slot is written off and the next one takes over.
 */
export const SLOT_WINDOW_MINUTES = 180;

/** Nothing is ever sent outside this window, whatever the maths says. */
export const ACTIVE_FROM_MINUTES = 8 * 60;
export const ACTIVE_UNTIL_MINUTES = 21 * 60 + 30;

/**
 * A long silence mid-day is its own signal.
 *
 * Someone who logged breakfast and nothing since 08:00 has usually not fasted
 * — they have stopped writing things down, which is the failure this whole
 * feature exists to catch. Independent of the slot rule so it still works for
 * people whose eating times are irregular enough that no median means much.
 */
export const GAP_MINUTES = 6 * 60;

/** One log's time of day, in minutes since Belgrade midnight. */
export type LogMinutes = number;

export interface MealHistory {
  /** For each slot, the times of day it was logged on PAST days — one entry per
   * day per slot (the day's first log in that slot). */
  byslot: Record<MealSlot, LogMinutes[]>;
}

/** Median of a non-empty list, rounded to a whole minute. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** The user's usual time for each meal: their own median where there is enough
 * history, the default otherwise. */
export function usualMealMinutes(
  history: MealHistory
): Record<MealSlot, number> {
  const out = { ...DEFAULT_USUAL_MINUTES };

  for (const slot of MEAL_SLOTS) {
    const times = history.byslot[slot];
    if (times.length >= MIN_DAYS_FOR_RHYTHM) {
      out[slot] = median(times);
    }
  }

  return out;
}

/** Why a meal reminder is being sent — the copy differs per case. */
export type MealNudgeReason =
  | { kind: "slot"; slot: MealSlot }
  | { kind: "gap"; sinceMinutes: number; lastSlot: MealSlot };

export interface MealNudgeInput {
  /** Times of day of everything the user logged TODAY. */
  todayLogMinutes: readonly LogMinutes[];
  /** Their past-days history, for the medians. */
  history: MealHistory;
  /** Minutes since Belgrade midnight, right now. */
  nowMinutes: number;
}

/**
 * The meal reminder due right now, or null.
 *
 * Order matters: the slot rule is checked first and the LATEST qualifying slot
 * wins. At 20:00 someone who has logged nothing all day should hear about
 * dinner, not about the breakfast they are no longer going to eat.
 */
export function mealNudgeDue({
  todayLogMinutes,
  history,
  nowMinutes,
}: MealNudgeInput): MealNudgeReason | null {
  if (nowMinutes < ACTIVE_FROM_MINUTES) return null;
  if (nowMinutes > ACTIVE_UNTIL_MINUTES) return null;

  const usual = usualMealMinutes(history);
  const loggedSlots = new Set(todayLogMinutes.map(slotOf));

  // Latest first: the meal nearest to now is the one worth asking about.
  for (const slot of ["dinner", "lunch", "breakfast"] as const) {
    if (loggedSlots.has(slot)) continue;

    const since = nowMinutes - usual[slot];
    if (since >= GRACE_MINUTES && since <= SLOT_WINDOW_MINUTES) {
      return { kind: "slot", slot };
    }
  }

  // The silence rule, for days that fit no slot's window — e.g. breakfast at
  // 08:00 and nothing by 15:00, with lunch's window already closed.
  if (todayLogMinutes.length > 0) {
    const last = Math.max(...todayLogMinutes);
    const sinceMinutes = nowMinutes - last;
    if (sinceMinutes >= GAP_MINUTES) {
      return { kind: "gap", sinceMinutes, lastSlot: slotOf(last) };
    }
  }

  return null;
}
