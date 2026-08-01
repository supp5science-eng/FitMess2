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

/**
 * The scheduled reminders. Each is independently switchable and timed.
 *
 * `weighin` (2026-08-01) is the odd one out: it fires on ONE WEEKDAY rather
 * than every day, because the weekly weigh-in it asks for is only comparable
 * week to week if it happens on the same day each time. Everything else about
 * it -- the time, the lateness window, the once-a-day guard -- is identical to
 * the other two.
 */
export type ReminderKind = "morning" | "evening" | "weighin";

export const REMINDER_KINDS: readonly ReminderKind[] = [
  "morning",
  "evening",
  "weighin",
];

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
  // 0024. Optional because a row written before that migration has none, and
  // because an environment that has not applied it must degrade to "no weigh-in
  // reminder", never to a failed run of the other two.
  weighin_enabled?: boolean;
  /** 0 = Monday .. 6 = Sunday (`belgradeWeekdayIndex`), NOT JS's order. */
  weighin_day?: number;
  weighin_time?: string;
  weighin_last_sent?: string | null;
}

export interface DueInput {
  settings: readonly ReminderSettingsRow[];
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
  if (kind === "morning") {
    return {
      enabled: row.morning_enabled,
      time: row.morning_time,
      lastSent: row.morning_last_sent,
    };
  }
  if (kind === "evening") {
    return {
      enabled: row.evening_enabled,
      time: row.evening_time,
      lastSent: row.evening_last_sent,
    };
  }
  return {
    enabled: row.weighin_enabled ?? false,
    time: row.weighin_time ?? "09:00",
    lastSent: row.weighin_last_sent ?? null,
  };
}

/** Every reminder due in this run, as (user, kind) pairs. A single user can
 * appear twice only if their two times fall in the same window — which the
 * settings screen allows but nobody sensible configures. */
export function remindersDue({
  settings,
  todayKey,
  nowMinutes,
  todayWeekdayIndex,
}: DueInput): DueReminder[] {
  const due: DueReminder[] = [];

  for (const row of settings) {
    for (const kind of REMINDER_KINDS) {
      const { enabled, time, lastSent } = fieldsFor(row, kind);

      if (!enabled) continue;

      // The weekly one only exists on its own day. Without a weekday to check
      // against, it never fires -- silence beats nagging on a Tuesday.
      if (kind === "weighin") {
        if (todayWeekdayIndex == null) continue;
        if ((row.weighin_day ?? 6) !== todayWeekdayIndex) continue;
      }

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
