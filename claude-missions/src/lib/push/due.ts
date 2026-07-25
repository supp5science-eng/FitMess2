/**
 * Podsetnici: the pure "who should get a push right now?" decision.
 *
 * Deliberately free of Supabase, `web-push` and `Date.now()` — the sender route
 * gathers rows and the current instant, this decides, exactly like the rest of
 * the app keeps its money-math in testable pure functions.
 *
 * v1 has one reminder: **"danas nisi ništa uneo"**. The product rule (the owner
 * chose "smart, skip when not needed") is that it must never fire at someone
 * who is already logging, and never twice in a day:
 *
 *   1. the reminder is on,
 *   2. their chosen Belgrade wall-clock time has PASSED today,
 *   3. …but by no more than `MAX_LATE_MINUTES` — a 12:00 reminder landing at
 *      22:30 because the scheduler hiccuped is worse than not sending it,
 *   4. the day has zero logs,
 *   5. it has not already gone out today (`no_log_last_sent`).
 *
 * (3) and (5) together are what make the cron safely re-runnable: run it twice
 * in the same quarter-hour and the second run sends nothing.
 */

/** How long after the chosen time a missed reminder may still be sent. */
export const MAX_LATE_MINUTES = 120;

export interface ReminderSettingsRow {
  user_id: string;
  no_log_enabled: boolean;
  /** Belgrade wall clock, `"HH:MM"` or `"HH:MM:SS"` (Postgres `time`). */
  no_log_time: string;
  /** Belgrade calendar day (`"YYYY-MM-DD"`) it last fired, if ever. */
  no_log_last_sent: string | null;
}

export interface DueInput {
  settings: readonly ReminderSettingsRow[];
  /** User ids that already have at least one log on `todayKey`. */
  usersWithLogsToday: ReadonlySet<string>;
  /** Belgrade calendar day the run is happening on, `"YYYY-MM-DD"`. */
  todayKey: string;
  /** Minutes since Belgrade midnight, right now. */
  nowMinutes: number;
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

/** The user ids whose "nisi ništa uneo" reminder is due in this run. */
export function usersDueForNoLogReminder({
  settings,
  usersWithLogsToday,
  todayKey,
  nowMinutes,
}: DueInput): string[] {
  return settings
    .filter((row) => {
      if (!row.no_log_enabled) return false;
      // Already reminded today: never nag twice, and this is what makes a
      // re-run of the cron a no-op.
      if (row.no_log_last_sent === todayKey) return false;
      // They are logging — the reminder has nothing to say.
      if (usersWithLogsToday.has(row.user_id)) return false;

      const due = timeToMinutes(row.no_log_time);
      if (due === null) return false;

      const late = nowMinutes - due;
      return late >= 0 && late <= MAX_LATE_MINUTES;
    })
    .map((row) => row.user_id);
}
