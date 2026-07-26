/**
 * Podsetnici: the pure "who should get a push right now?" decision.
 *
 * Deliberately free of Supabase, `web-push` and `Date.now()` — the sender route
 * gathers rows and the current instant, this decides, exactly like the rest of
 * the app keeps its money-math in testable pure functions.
 *
 * v2 (2026-07-26) ships TWO daily reminders instead of one conditional one:
 *
 *   * morning — "log your breakfast", at the user's chosen time
 *   * evening — the recap, which reports how much budget is left
 *
 * Neither is skipped because the user has been logging. That is the whole
 * point of the change: v1's single reminder only fired on a day with ZERO
 * logs, so the people using the app daily never saw it. What the evening
 * reminder has to SAY still depends on the day (see `eveningPayload`) — but
 * whether it is sent does not.
 *
 * A reminder is due when:
 *
 *   1. it is on,
 *   2. its Belgrade wall-clock time has PASSED today,
 *   3. …but by no more than `MAX_LATE_MINUTES` — a 10:00 reminder landing at
 *      18:30 because the scheduler hiccuped is worse than not sending it,
 *   4. it has not already gone out today (`*_last_sent`).
 *
 * (3) and (4) together are what make the cron safely re-runnable: run it twice
 * in the same quarter-hour and the second run sends nothing.
 */

/** How long after the chosen time a missed reminder may still be sent. */
export const MAX_LATE_MINUTES = 120;

/** The two scheduled reminders. Each is independently switchable and timed. */
export type ReminderKind = "morning" | "evening";

export const REMINDER_KINDS: readonly ReminderKind[] = ["morning", "evening"];

export interface ReminderSettingsRow {
  user_id: string;
  morning_enabled: boolean;
  /** Belgrade wall clock, `"HH:MM"` or `"HH:MM:SS"` (Postgres `time`). */
  morning_time: string;
  /** Belgrade calendar day (`"YYYY-MM-DD"`) it last fired, if ever. */
  morning_last_sent: string | null;
  evening_enabled: boolean;
  evening_time: string;
  evening_last_sent: string | null;
}

export interface DueInput {
  settings: readonly ReminderSettingsRow[];
  /** Belgrade calendar day the run is happening on, `"YYYY-MM-DD"`. */
  todayKey: string;
  /** Minutes since Belgrade midnight, right now. */
  nowMinutes: number;
}

/** One reminder that should go out in this run. */
export interface DueReminder {
  userId: string;
  kind: ReminderKind;
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

/** The one row's fields for a given reminder, so the rule below is written
 * once instead of once per kind. */
function fieldsFor(
  row: ReminderSettingsRow,
  kind: ReminderKind
): { enabled: boolean; time: string; lastSent: string | null } {
  return kind === "morning"
    ? {
        enabled: row.morning_enabled,
        time: row.morning_time,
        lastSent: row.morning_last_sent,
      }
    : {
        enabled: row.evening_enabled,
        time: row.evening_time,
        lastSent: row.evening_last_sent,
      };
}

/** Every reminder due in this run, as (user, kind) pairs. A single user can
 * appear twice only if their two times fall in the same window — which the
 * settings screen allows but nobody sensible configures. */
export function remindersDue({
  settings,
  todayKey,
  nowMinutes,
}: DueInput): DueReminder[] {
  const due: DueReminder[] = [];

  for (const row of settings) {
    for (const kind of REMINDER_KINDS) {
      const { enabled, time, lastSent } = fieldsFor(row, kind);

      if (!enabled) continue;
      // Already sent today: never nag twice, and this is what makes a re-run
      // of the cron a no-op.
      if (lastSent === todayKey) continue;

      const at = timeToMinutes(time);
      if (at === null) continue;

      const late = nowMinutes - at;
      if (late >= 0 && late <= MAX_LATE_MINUTES) {
        due.push({ userId: row.user_id, kind });
      }
    }
  }

  return due;
}
