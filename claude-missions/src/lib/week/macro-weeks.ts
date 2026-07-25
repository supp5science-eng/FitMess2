/**
 * Analitika "Dnevni prosek kalorija" card: pure, DB-free arithmetic that turns
 * a trailing window of logs into per-week, per-day macro-stacked summaries.
 *
 * Same "money-math rule" as the rest of the app (see `src/lib/week/summary.ts`,
 * `src/lib/home/totals.ts`): deterministic code computes every number the card
 * shows, nothing is eyeballed in the component.
 *
 * Formula decisions (derived from the reference design, where the headline
 * average equals a single logged day's bar):
 *  - Daily average = total kcal in the week ÷ number of days WITH AT LEAST ONE
 *    LOG (not ÷ 7, and not ÷ elapsed days). "On the days you tracked, you
 *    averaged X" -- untracked days never drag the number down.
 *  - Each day's bar height = that day's stored kcal (the truth), split into
 *    protein/carb/fat segments PROPORTIONAL to their calorie contribution
 *    (protein & carbs at 4 kcal/g, fat at 9 kcal/g) so the segments always sum
 *    back to the day's kcal.
 *  - Change vs the previous week = (thisAvg − priorAvg) / priorAvg, in percent;
 *    null when there is no prior tracked data to compare against.
 */

import { analyticsDayLabel } from "@/lib/analytics/day-label";
import { belgradeWeekStartDay, toBelgradeCalendarDay } from "@/lib/dates";
import { WEEKDAY_LABELS_SR } from "@/lib/week/summary";

const PROTEIN_KCAL_PER_G = 4;
const CARBS_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;

/** Minimal log shape this module needs (a subset of a `logs` row). */
export interface MacroLogInput {
  logged_at: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroDay {
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  /** Long label for the tap read-out: "Danas" / "Juče" / "Sreda, 22. jul". */
  longLabel: string;
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Total kcal logged that day (whole; the bar's height). */
  totalKcal: number;
  /** kcal attributed to each macro; the three sum to `totalKcal`. */
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  /** The day's macro grams as logged (whole) -- what the tap read-out names.
   * These are the RAW sums, not the proportionally-adjusted bar segments. */
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True if at least one log landed on this day. */
  logged: boolean;
  /** True if the day is still in the future (this week, not yet reached). */
  isFuture: boolean;
}

export interface MacroWeek {
  /** 0 = this week, 1 = last week, 2 = two weeks ago, ... */
  index: number;
  /** Exactly 7 entries, Monday..Sunday. */
  days: MacroDay[];
  /** Days with at least one log this week. */
  loggedDaysCount: number;
  /** Mean kcal across LOGGED days (whole); 0 when nothing was tracked. */
  dailyAverageKcal: number;
  /** Percent change of the daily average vs the previous week; null when there
   * is no prior tracked data to compare against. */
  changePct: number | null;
}

/** The 7 Belgrade day keys (Mon..Sun) of the week `k` weeks before `now`. */
function weekDayKeys(now: Date, k: number): string[] {
  const [year, month, day] = belgradeWeekStartDay(now).split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    toBelgradeCalendarDay(new Date(Date.UTC(year!, month! - 1, day! - 7 * k + i)))
  );
}

interface DayBucket {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Builds `count` weekly summaries (index 0 = this week, newest first) from a
 * trailing window of logs. One extra week is computed internally so the oldest
 * returned week can still get a `changePct` when its prior week is in-window.
 * `now` defaults to the current instant; pass it for deterministic tests.
 */
export function computeMacroWeeks(
  logs: MacroLogInput[],
  now: Date = new Date(),
  count = 4
): MacroWeek[] {
  const todayKey = toBelgradeCalendarDay(now);

  // Bucket every log onto its Belgrade calendar day.
  const byDay = new Map<string, DayBucket>();
  for (const log of logs) {
    const key = toBelgradeCalendarDay(new Date(log.logged_at));
    const bucket = byDay.get(key) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    bucket.kcal += log.kcal;
    bucket.protein += log.protein;
    bucket.carbs += log.carbs;
    bucket.fat += log.fat;
    byDay.set(key, bucket);
  }

  // Compute count + 1 weeks; the extra tail week is only a change baseline.
  const weeks: MacroWeek[] = [];
  for (let k = 0; k <= count; k++) {
    const keys = weekDayKeys(now, k);
    const days: MacroDay[] = keys.map((dayKey, weekdayIndex) => {
      const bucket = byDay.get(dayKey);
      const totalKcal = Math.round(bucket?.kcal ?? 0);

      const proteinCal = (bucket?.protein ?? 0) * PROTEIN_KCAL_PER_G;
      const carbsCal = (bucket?.carbs ?? 0) * CARBS_KCAL_PER_G;
      const fatCal = (bucket?.fat ?? 0) * FAT_KCAL_PER_G;
      const macroCal = proteinCal + carbsCal + fatCal;

      let proteinKcal = 0;
      let carbsKcal = 0;
      let fatKcal = 0;
      if (totalKcal > 0 && macroCal > 0) {
        proteinKcal = Math.round((totalKcal * proteinCal) / macroCal);
        carbsKcal = Math.round((totalKcal * carbsCal) / macroCal);
        // Fat absorbs the rounding remainder so the three always sum to total.
        fatKcal = Math.max(0, totalKcal - proteinKcal - carbsKcal);
      }

      return {
        label: WEEKDAY_LABELS_SR[weekdayIndex]!,
        longLabel: analyticsDayLabel(dayKey, now),
        dayKey,
        totalKcal,
        proteinKcal,
        carbsKcal,
        fatKcal,
        proteinG: Math.round(bucket?.protein ?? 0),
        carbsG: Math.round(bucket?.carbs ?? 0),
        fatG: Math.round(bucket?.fat ?? 0),
        logged: byDay.has(dayKey),
        isFuture: dayKey > todayKey,
      };
    });

    const loggedDays = days.filter((d) => d.logged);
    const loggedDaysCount = loggedDays.length;
    const sumKcal = loggedDays.reduce((sum, d) => sum + d.totalKcal, 0);
    const dailyAverageKcal =
      loggedDaysCount > 0 ? Math.round(sumKcal / loggedDaysCount) : 0;

    weeks.push({
      index: k,
      days,
      loggedDaysCount,
      dailyAverageKcal,
      changePct: null,
    });
  }

  // Percent change of each week's average vs the week before it.
  for (let k = 0; k < count; k++) {
    const current = weeks[k]!;
    const prior = weeks[k + 1];
    if (prior && prior.dailyAverageKcal > 0 && current.dailyAverageKcal > 0) {
      current.changePct = Math.round(
        ((current.dailyAverageKcal - prior.dailyAverageKcal) /
          prior.dailyAverageKcal) *
          100
      );
    }
  }

  return weeks.slice(0, count);
}
