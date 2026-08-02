/**
 * Podsetnici: the pure "who should get a push right now?" decision.
 *
 * Deliberately free of Supabase, `web-push` and `Date.now()` — the sender route
 * gathers rows and the current instant, this decides, exactly like the rest of
 * the app keeps its money-math in testable pure functions.
 *
 * v3 (2026-08-01) is a rewrite of what gets sent at all, after the v2 reminders
 * turned out to be the kind people mute:
 *
 *   * `meal` REPLACES the fixed 10:00 "upiši doručak". It fires off the user's
 *     OWN eating rhythm (`meal-rhythm.ts`) and only when that meal is actually
 *     missing. A reminder that arrives at the same minute regardless of what
 *     you did is not a reminder, it is a clock.
 *   * `evening` no longer goes out unconditionally. It is sent only when it has
 *     something to say — an empty day, an overshoot, a lot of unused budget, or
 *     a training day nobody wrote down. A notification with no news spends
 *     credit the next one needs.
 *   * `weighin` (weekly) is unchanged.
 *   * A HARD CEILING of `MAX_PER_DAY` sits over all of it. Two a day, ever,
 *     whatever the rules above conclude — the product owner's number, and the
 *     line between "helpful" and "the app I turned off".
 *
 * A scheduled reminder is due when:
 *
 *   1. it is on,
 *   2. its Belgrade wall-clock time has PASSED today,
 *   3. …but by no more than `MAX_LATE_MINUTES` — a 10:00 reminder landing at
 *      18:30 because the scheduler hiccuped is worse than not sending it,
 *   4. it has not already gone out today (`*_last_sent`),
 *   5. and the day's budget is not spent.
 *
 * (3), (4) and (5) together are what make the cron safely re-runnable: run it
 * twice in the same quarter-hour and the second run sends nothing.
 */

import { weighInAnswered } from "@/lib/weight/weigh-in-day";

import { mealNudgeDue, type MealHistory, type MealNudgeReason } from "./meal-rhythm";

/** How long after the chosen time a missed reminder may still be sent. */
export const MAX_LATE_MINUTES = 120;

/**
 * The most pushes one person can get in one day, from all reminders combined.
 *
 * Not a guess: the whole reason this file was rewritten is that the app was
 * sending two guaranteed daily notifications that said nothing, and people
 * mute what they cannot predict the value of. Everything below competes for
 * these two slots, in priority order.
 */
export const MAX_PER_DAY = 2;

/**
 * How much of the daily budget must be left unused before the evening recap
 * bothers to say so. Under this, "you have some calories left" is noise.
 */
export const EVENING_LEFTOVER_KCAL = 400;

/**
 * The reminders, in the order they win the day's two slots.
 *
 * `weighin` first because it is weekly and the plan's self-correction depends
 * on it; `meal` before `evening` because a meal can still be logged today while
 * a recap is only ever a report.
 */
export type ReminderKind = "weighin" | "meal" | "evening";

export const REMINDER_KINDS: readonly ReminderKind[] = [
  "weighin",
  "meal",
  "evening",
];

export interface ReminderSettingsRow {
  user_id: string;
  /** The meal reminder (0027). Timed by the user's rhythm, not a column. */
  meal_enabled?: boolean;
  meal_last_sent?: string | null;
  evening_enabled: boolean;
  /** Belgrade wall clock, `"HH:MM"` or `"HH:MM:SS"` (Postgres `time`). */
  evening_time: string;
  /** Belgrade calendar day (`"YYYY-MM-DD"`) it last fired, if ever. */
  evening_last_sent: string | null;
  // 0024. Optional because a row written before that migration has none, and
  // because an environment that has not applied it must degrade to "no weigh-in
  // reminder", never to a failed run of the others.
  weighin_enabled?: boolean;
  /** 0 = Monday .. 6 = Sunday (`belgradeWeekdayIndex`), NOT JS's order. */
  weighin_day?: number;
  weighin_time?: string;
  weighin_last_sent?: string | null;
  /** The day `sent_count` is counting (0027). */
  sent_day?: string | null;
  /** Pushes already sent to this user today — the ceiling's bookkeeping. */
  sent_count?: number;
}

/**
 * What the sender found out about one user's day.
 *
 * Everything here is a FACT about today, never a decision: the decisions all
 * live in this file so they can be tested without a database.
 */
export interface UserDayFacts {
  /** Times of day (minutes since Belgrade midnight) of today's logs. */
  todayLogMinutes: readonly number[];
  /** Past days' logging times, for the user's median meal times. */
  history: MealHistory;
  /** Whether the user logged any training today. */
  hasWorkoutToday: boolean;
  /**
   * Whether this person uses the training feature at all (any workout in the
   * recent past). Someone who has never logged one must not be asked about it:
   * a reminder to do something you don't do is the fastest way to lose the
   * permission for everything else.
   */
  usesWorkouts: boolean;
  /** Logs made today. */
  loggedMeals: number;
  /** False when the user has no daily target yet (fresh account). */
  hasTarget: boolean;
  /** Whole kcal left in the day's budget; 0 once at/over it. */
  remainingKcal: number;
  /** Whole kcal past the budget; 0 while still under. */
  overshootKcal: number;
}

export interface DueInput {
  settings: readonly ReminderSettingsRow[];
  /** Per user, today's facts. A user missing from this map gets only the
   * reminders that need no facts (the weekly weigh-in). */
  facts?: ReadonlyMap<string, UserDayFacts>;
  /**
   * Per user, the day of their newest weigh-in — what makes the weekly
   * reminder shut up once the week has been answered.
   *
   * OMIT IT and every weigh-in reminder fires on schedule, which is the old
   * behaviour and the safe direction when the caller has no data: a reminder
   * nobody needed costs a tap, a skipped week costs the plan its only
   * measurement. A user absent from a supplied map means "never weighed in".
   */
  lastWeighIn?: ReadonlyMap<string, string | null>;
  /** Belgrade calendar day the run is happening on, `"YYYY-MM-DD"`. */
  todayKey: string;
  /** Minutes since Belgrade midnight, right now. */
  nowMinutes: number;
  /**
   * Today's Belgrade weekday, 0 = Monday .. 6 = Sunday. Only the weekly
   * `weighin` reminder needs it; omit it and that reminder simply never comes
   * due, which is the right behaviour for any caller that has no calendar.
   */
  todayWeekdayIndex?: number;
}

/** One reminder that should go out in this run. */
export interface DueReminder {
  userId: string;
  kind: ReminderKind;
  /** For `meal`, which meal and why — the copy depends on it. */
  mealReason?: MealNudgeReason;
}

/** `"12:30"` / `"12:30:00"` -> 750. Returns null for anything unparseable. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Whether the evening recap has anything worth interrupting someone for.
 *
 * Four cases earn it, and "the day went fine and everything is written down"
 * is deliberately not one of them.
 */
export function eveningHasSomethingToSay(facts: UserDayFacts): boolean {
  // Nothing logged: the one case where the recap is really a last call.
  if (facts.loggedMeals === 0) return true;

  // A training day nobody wrote down — the reason this reminder still exists
  // now that the meal nudge covers food.
  if (facts.usesWorkouts && !facts.hasWorkoutToday) return true;

  if (!facts.hasTarget) return false;

  if (facts.overshootKcal > 0) return true;

  // A lot of budget still unused usually means a meal was eaten and not
  // logged, not that the person skipped dinner.
  return facts.remainingKcal >= EVENING_LEFTOVER_KCAL;
}

/** Whether a `*_last_sent` guard and a clock time say this reminder is due. */
function scheduledDue({
  enabled,
  time,
  lastSent,
  todayKey,
  nowMinutes,
}: {
  enabled: boolean;
  time: string;
  lastSent: string | null;
  todayKey: string;
  nowMinutes: number;
}): boolean {
  if (!enabled) return false;
  if (lastSent === todayKey) return false;

  const at = timeToMinutes(time);
  if (at === null) return false;

  const late = nowMinutes - at;
  return late >= 0 && late <= MAX_LATE_MINUTES;
}

/**
 * Every reminder due in this run, as (user, kind) pairs — at most
 * `MAX_PER_DAY` per user per day, counting what has already gone out today.
 */
export function remindersDue({
  settings,
  facts,
  lastWeighIn,
  todayKey,
  nowMinutes,
  todayWeekdayIndex,
}: DueInput): DueReminder[] {
  const due: DueReminder[] = [];

  for (const row of settings) {
    // The ceiling, first: a user who has had their two is done for the day,
    // whatever else is true. `sent_day` from a previous day means zero spent.
    const spent = row.sent_day === todayKey ? (row.sent_count ?? 0) : 0;
    let budget = MAX_PER_DAY - spent;
    if (budget <= 0) continue;

    const userFacts = facts?.get(row.user_id);

    for (const kind of REMINDER_KINDS) {
      if (budget <= 0) break;

      if (kind === "weighin") {
        // The weekly one only exists on its own day. Without a weekday to check
        // against, it never fires -- silence beats nagging on a Tuesday.
        if (todayWeekdayIndex == null) continue;
        if ((row.weighin_day ?? 6) !== todayWeekdayIndex) continue;
        if (
          !scheduledDue({
            enabled: row.weighin_enabled ?? false,
            time: row.weighin_time ?? "09:00",
            lastSent: row.weighin_last_sent ?? null,
            todayKey,
            nowMinutes,
          })
        ) {
          continue;
        }
        // The same question the `/danas` banner asks, answered by the same
        // function -- so the notification can never call someone to the scale
        // on a week the screen itself has already stopped asking about. That
        // was live until 2026-08-02: someone who weighed in on Saturday under
        // a Sunday schedule got a Sunday push for a week the app considered
        // settled, then found no banner when they opened it.
        //
        // `todayKey` IS the scheduled day here -- the weekday check above just
        // established that -- so it is passed straight in rather than derived
        // a second time.
        if (
          lastWeighIn !== undefined &&
          weighInAnswered(todayKey, lastWeighIn.get(row.user_id) ?? null)
        ) {
          continue;
        }
        due.push({ userId: row.user_id, kind });
        budget -= 1;
        continue;
      }

      // Both remaining reminders are conditional on how the day is going, so
      // without facts they cannot be judged — and an unjudged reminder is not
      // sent. That is the safe direction: silence, never a guess.
      if (!userFacts) continue;

      if (kind === "meal") {
        if ((row.meal_enabled ?? false) === false) continue;
        if ((row.meal_last_sent ?? null) === todayKey) continue;

        const reason = mealNudgeDue({
          todayLogMinutes: userFacts.todayLogMinutes,
          history: userFacts.history,
          nowMinutes,
        });
        if (!reason) continue;

        due.push({ userId: row.user_id, kind, mealReason: reason });
        budget -= 1;
        continue;
      }

      if (
        !scheduledDue({
          enabled: row.evening_enabled,
          time: row.evening_time,
          lastSent: row.evening_last_sent,
          todayKey,
          nowMinutes,
        })
      ) {
        continue;
      }
      if (!eveningHasSomethingToSay(userFacts)) continue;

      due.push({ userId: row.user_id, kind });
      budget -= 1;
    }
  }

  return due;
}
