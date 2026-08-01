/**
 * Nedeljno merenje: WHEN the app asks for a weigh-in, and whether it is
 * currently waiting on one.
 *
 * Pure and DB-free -- the callers (the `/danas` banner, the reminder sender,
 * the settings screen) supply the day keys and this decides. Days are Belgrade
 * calendar days throughout, and the weekday index is the app's own convention
 * (0 = Monday .. 6 = Sunday, `belgradeWeekdayIndex` in `src/lib/dates.ts`), not
 * JavaScript's Sunday-first one.
 *
 * The default is Sunday morning. Weighing on the same weekday every time is not
 * fussiness: body weight follows a weekly rhythm (heavier after weekend eating,
 * lighter mid-week), so a Sunday reading compared against a Wednesday one can
 * invent a kilogram of "change" that never happened. The instruction the UI
 * shows -- morning, after the toilet, before eating, undressed -- exists for the
 * same reason. Consistency matters more than which day is chosen.
 */

import { belgradeWeekdayIndex, toBelgradeCalendarDay } from "@/lib/dates";

/** 0 = Monday .. 6 = Sunday. Sunday by default. */
export const DEFAULT_WEIGH_IN_DAY = 6;

/** Belgrade wall-clock time the weekly push goes out on the chosen day. */
export const DEFAULT_WEIGH_IN_TIME = "09:00";

export const WEIGH_IN_DAY_LABELS_SR = [
  "ponedeljkom",
  "utorkom",
  "sredom",
  "četvrtkom",
  "petkom",
  "subotom",
  "nedeljom",
] as const;

/** Clamps anything (bad data, a client-sent number) into 0..6. */
export function normalizeWeighInDay(value: number | null | undefined): number {
  if (value == null || !Number.isInteger(value)) return DEFAULT_WEIGH_IN_DAY;
  if (value < 0 || value > 6) return DEFAULT_WEIGH_IN_DAY;
  return value;
}

/** `"YYYY-MM-DD"` shifted by `delta` days. */
function shiftDay(dayKey: string, delta: number): string {
  const [year, month, date] = dayKey.split("-").map(Number);
  return toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, date! + delta))
  );
}

function weekdayOf(dayKey: string): number {
  return belgradeWeekdayIndex(new Date(`${dayKey}T12:00:00.000Z`));
}

/**
 * The most recent scheduled weigh-in day on or before `todayKey`. If today IS
 * the chosen day, that is today.
 */
export function lastScheduledWeighIn(
  todayKey: string,
  weighInDay: number
): string {
  const target = normalizeWeighInDay(weighInDay);
  const back = (weekdayOf(todayKey) - target + 7) % 7;
  return shiftDay(todayKey, -back);
}

/** The next scheduled weigh-in day strictly after `todayKey`. */
export function nextScheduledWeighIn(
  todayKey: string,
  weighInDay: number
): string {
  const target = normalizeWeighInDay(weighInDay);
  const forward = ((target - weekdayOf(todayKey) + 7) % 7) || 7;
  return shiftDay(todayKey, forward);
}

export interface WeighInDueState {
  /** True while the app is waiting for the current week's weigh-in. */
  due: boolean;
  /** The scheduled day the app is waiting on (or the next one, if not due). */
  scheduledDay: string;
  /** Days since that scheduled day passed -- 0 on the day itself. */
  daysWaiting: number;
  /** The user's last weigh-in, if any. */
  lastWeighInDay: string | null;
}

/**
 * Whether the weekly weigh-in is outstanding.
 *
 * Outstanding means: the week's scheduled day has arrived, and nothing has been
 * weighed on or after it. The banner then stays up until the user records one
 * -- it is a nag, deliberately, because the whole feature is worthless without
 * the reading, but it never blocks anything.
 *
 * One day of grace on the early side: someone who steps on the scale on
 * Saturday morning for a Sunday schedule has answered the question, and asking
 * them to weigh twice inside 24 hours is the kind of chore that gets a feature
 * switched off. A WEDNESDAY reading is a different matter -- body weight follows
 * a weekly rhythm, so comparing a Wednesday against a run of Sundays invents
 * change that never happened, and the Sunday slot is still asked for.
 */

/** How many days BEFORE the scheduled day a weigh-in still settles the week. */
export const EARLY_GRACE_DAYS = 1;
export function weighInDueState({
  todayKey,
  weighInDay,
  lastWeighInDay,
}: {
  todayKey: string;
  weighInDay: number;
  lastWeighInDay: string | null;
}): WeighInDueState {
  const scheduledDay = lastScheduledWeighIn(todayKey, weighInDay);
  const settlesFrom = shiftDay(scheduledDay, -EARLY_GRACE_DAYS);
  const answered = lastWeighInDay != null && lastWeighInDay >= settlesFrom;
  const [y, m, d] = scheduledDay.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const daysWaiting = Math.round(
    (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(y!, m! - 1, d!)) / 86_400_000
  );

  return {
    due: !answered,
    scheduledDay: answered
      ? nextScheduledWeighIn(todayKey, weighInDay)
      : scheduledDay,
    daysWaiting: answered ? 0 : Math.max(0, daysWaiting),
    lastWeighInDay,
  };
}
