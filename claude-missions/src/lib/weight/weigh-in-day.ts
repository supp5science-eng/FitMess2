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
 * Outstanding means: the week's scheduled day has arrived, nothing has been
 * weighed on or around it, and we are still close enough to that day for a
 * reading to belong to it.
 *
 * That last clause is the important one, and it was missing until 2026-08-01.
 * The ask used to stand until it was answered, so a Sunday schedule was still
 * nagging on Saturday -- asking, six days late, for "last Sunday's weight".
 * There is no such thing. Body weight follows a weekly rhythm (heavier after
 * weekend eating, lighter mid-week), which is the entire reason this feature
 * pins a weekday at all; a Saturday number dropped into Sunday's slot doesn't
 * fill the gap, it poisons the trend with a kilogram of change that never
 * happened. A missed week is missed. The engine already knows how to say
 * INSUFFICIENT_DATA, and silence for a few days is cheaper than a wrong
 * correction to someone's calories.
 *
 * So the window is symmetric and narrow: one day either side of the scheduled
 * day. Saturday-for-Sunday counts because someone who stepped on the scale
 * yesterday morning has answered the question, and asking them to weigh twice
 * inside 24 hours is the kind of chore that gets a feature switched off.
 * Monday-for-Sunday counts because sleeping in once should not cost a whole
 * week when the trend needs three of them. Tuesday does not.
 */

/** How many days BEFORE the scheduled day a weigh-in still settles the week. */
export const EARLY_GRACE_DAYS = 1;

/**
 * How many days AFTER the scheduled day the app keeps asking.
 *
 * Not "how long the reading stays useful" -- how long the ASK stays honest.
 * Past this the week is written off rather than filled in late.
 */
export const LATE_GRACE_DAYS = 1;
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

  // Answered, or too late to still be this week's reading. Either way the app
  // stops asking and looks to the next scheduled day.
  const due = !answered && daysWaiting <= LATE_GRACE_DAYS;

  return {
    due,
    scheduledDay: due
      ? scheduledDay
      : nextScheduledWeighIn(todayKey, weighInDay),
    daysWaiting: due ? Math.max(0, daysWaiting) : 0,
    lastWeighInDay,
  };
}
