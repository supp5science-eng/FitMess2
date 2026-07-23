/**
 * F071: pure decision logic for the daily Web Push reminder (AS-117).
 *
 * Framework-free and unit-testable in isolation (the same pattern as
 * `src/lib/onboarding/validation.ts`): the cron route
 * (`src/app/api/cron/reminders/route.ts`) fetches candidates and sends
 * pushes, but every "is this user due RIGHT NOW?" decision is made here.
 *
 * Due-ness rules, all in Europe/Belgrade wall-clock (per tech-decisions'
 * "day boundaries via src/lib/dates.ts, never raw new Date() math"):
 *  - the user has a reminder time set (NULL = off, AS-118);
 *  - the current Belgrade time is AT or AFTER the chosen time, but within a
 *    bounded window after it — the cron ticks every 5 minutes, so a healthy
 *    system sends within minutes of the chosen time; the window stops a
 *    recovered outage (or a cron re-enabled at 23:50) from firing a stale
 *    "08:00" reminder late at night;
 *  - it wasn't already sent today (`reminder_last_sent_on`, idempotency);
 *  - the user hasn't already logged a meal today (zero-shame: never nag
 *    someone who already did the thing).
 */

const BELGRADE_TZ = "Europe/Belgrade";

/** How long after the chosen time a reminder is still worth sending. */
export const REMINDER_WINDOW_MINUTES = 90;

/** Minutes-since-midnight of `now` in Europe/Belgrade wall-clock. */
export function belgradeMinutesOfDay(now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BELGRADE_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** Parses a Postgres `time` value (`"HH:MM"` or `"HH:MM:SS"`) into
 * minutes-since-midnight, or `null` for anything malformed. */
export function parseTimeToMinutes(value: string | null): number | null {
  if (value === null) return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export interface ReminderCandidate {
  /** `profiles.reminder_time` — Postgres `time` string, NULL = off. */
  reminderTime: string | null;
  /** `profiles.reminder_last_sent_on` — Belgrade `"YYYY-MM-DD"` or NULL. */
  lastSentOn: string | null;
  /** Whether the user already logged a meal today (Belgrade day). */
  hasLoggedToday: boolean;
}

/**
 * The one due-ness decision. `todayKey` is the current Belgrade calendar day
 * (`toBelgradeCalendarDay(now)`), passed in so the function stays pure.
 */
export function isReminderDue(
  candidate: ReminderCandidate,
  now: Date,
  todayKey: string
): boolean {
  const reminderMinutes = parseTimeToMinutes(candidate.reminderTime);
  if (reminderMinutes === null) return false;
  if (candidate.lastSentOn === todayKey) return false;
  if (candidate.hasLoggedToday) return false;

  const nowMinutes = belgradeMinutesOfDay(now);
  return (
    nowMinutes >= reminderMinutes &&
    nowMinutes < reminderMinutes + REMINDER_WINDOW_MINUTES
  );
}

/** The push payload shape both the cron route and `sw.js` agree on. */
export interface ReminderPayload {
  title: string;
  body: string;
  /** Where a tap on the notification lands. */
  url: string;
}

/** Serbian, zero-shame daily-reminder copy (ti-form, no guilt). */
export function buildReminderPayload(name: string | null): ReminderPayload {
  const trimmed = name?.trim() ?? "";
  return {
    title: trimmed !== "" ? `${trimmed}, vreme je za unos 🍽️` : "Vreme je za unos 🍽️",
    body: "Upiši šta si jeo/la danas — traje par sekundi, a nedelja se lakše drži kad je dan zabeležen.",
    url: "/danas",
  };
}
