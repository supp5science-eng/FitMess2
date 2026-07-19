/**
 * F041 (meal-history section on `/analitika`): pure grouping of a flat list
 * of logged meals into per-day buckets with friendly Serbian day labels
 * ("Danas" / "Juče" / "sreda, 15. jul"), newest day first, newest meal first
 * within a day. DB-free -- the page fetches the rows, this shapes them.
 */

import {
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";

export interface MealLogItem {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_at: string;
}

export interface DayGroup {
  /** Belgrade calendar day `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Friendly Serbian label for the day header. */
  label: string;
  /** Sum of the day's logged kcal (whole number). */
  totalKcal: number;
  /** The day's meals, newest first. */
  logs: MealLogItem[];
}

const WEEKDAY_FULL_SR = [
  "nedelja", // JS getUTCDay 0 = Sunday
  "ponedeljak",
  "utorak",
  "sreda",
  "četvrtak",
  "petak",
  "subota",
] as const;

const MONTHS_SR = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
] as const;

/**
 * Label for a day header given the day's key and today's / yesterday's keys:
 * "Danas", "Juče", otherwise "<weekday>, <d>. <month>" (e.g. "sreda, 15.
 * jul"). Pure string math off the `"YYYY-MM-DD"` key -- no timezone work
 * (the key already encodes the Belgrade calendar day).
 */
export function belgradeDayLabel(
  dayKey: string,
  todayKey: string,
  yesterdayKey: string
): string {
  if (dayKey === todayKey) return "Danas";
  if (dayKey === yesterdayKey) return "Juče";

  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return `${WEEKDAY_FULL_SR[weekday]}, ${day}. ${MONTHS_SR[month! - 1]}`;
}

/**
 * Groups meals by their Belgrade calendar day. Days are returned newest
 * first; meals within a day are ordered newest first. An empty input yields
 * an empty array.
 */
export function groupLogsByDay(
  logs: MealLogItem[],
  now: Date = new Date()
): DayGroup[] {
  const todayKey = toBelgradeCalendarDay(now);
  // One second before today's Belgrade midnight lands in yesterday -- robust
  // across DST and month/year boundaries.
  const yesterdayKey = toBelgradeCalendarDay(
    new Date(startOfBelgradeDay(now).getTime() - 1000)
  );

  const byDay = new Map<string, MealLogItem[]>();
  for (const log of logs) {
    const key = toBelgradeCalendarDay(new Date(log.logged_at));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(log);
    else byDay.set(key, [log]);
  }

  return Array.from(byDay.keys())
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // newest day first
    .map((dayKey) => {
      const dayLogs = byDay
        .get(dayKey)!
        .slice()
        .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1)); // newest meal first
      return {
        dayKey,
        label: belgradeDayLabel(dayKey, todayKey, yesterdayKey),
        totalKcal: Math.round(
          dayLogs.reduce((sum, log) => sum + log.kcal, 0)
        ),
        logs: dayLogs,
      };
    });
}
