/**
 * Analitika "Voda" card: pure, DB-free arithmetic that turns a week of daily
 * water rows into a today-vs-goal summary plus a 7-day mini series.
 *
 * Same "money-math rule" as the rest of the app: deterministic code computes
 * every number the card draws; the component only maps the domain onto pixels.
 *
 * The daily goal is derived from bodyweight (~35 ml/kg, a common hydration
 * guideline), rounded to a tidy 100 ml and clamped to a sane 2.0–4.0 L band; a
 * missing weight falls back to a flat 2.5 L.
 */

import { toBelgradeCalendarDay } from "@/lib/dates";
import { WEEKDAY_LABELS_SR } from "@/lib/week/summary";

const WINDOW_DAYS = 7;
const ML_PER_KG = 35;
const GOAL_MIN_ML = 2000;
const GOAL_MAX_ML = 4000;
const GOAL_FALLBACK_ML = 2500;

/** Minimal water row shape this module needs (a `water_intake` subset). */
export interface WaterDayInput {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  ml: number;
}

export interface WaterDay {
  dayKey: string;
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  ml: number;
  isToday: boolean;
  /** True once this day met the goal. */
  reached: boolean;
}

export interface WaterWeek {
  /** 7 days, oldest → today. */
  days: WaterDay[];
  todayMl: number;
  goalMl: number;
  /** Today vs goal, 0..1. */
  pct: number;
  /** ml still needed today to hit the goal; 0 once reached. */
  remainingMl: number;
  reachedToday: boolean;
  /** Mean ml across days WITH intake this week; 0 if none. */
  weekAvgMl: number;
  /** Chart scale: max(goal, tallest day) so the goal line always fits. */
  maxMl: number;
  loggedDaysCount: number;
}

/** Daily water goal (ml) from bodyweight (~35 ml/kg), tidy + clamped. */
export function waterGoalMl(weightKg: number | null): number {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return GOAL_FALLBACK_ML;
  }
  const raw = Math.round((weightKg * ML_PER_KG) / 100) * 100;
  return Math.min(GOAL_MAX_ML, Math.max(GOAL_MIN_ML, raw));
}

/** `1250` → `"1,25 L"`, `250` → `"250 mL"` (Serbian comma decimal). */
export function formatWaterSr(ml: number): string {
  const safe = Math.max(0, Math.round(ml));
  if (safe < 1000) return `${safe} mL`;
  const trimmed = (safe / 1000)
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return `${trimmed} L`;
}

function weekdayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay(); // Sun=0
  return WEEKDAY_LABELS_SR[(jsDay + 6) % 7]!;
}

/**
 * Buckets the last 7 days of water rows into a fully-derived `WaterWeek`.
 * `now` defaults to the current instant; pass it for deterministic tests.
 */
export function computeWaterWeek(
  rows: WaterDayInput[],
  now: Date,
  goalMl: number
): WaterWeek {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const dayKeys = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    toBelgradeCalendarDay(
      new Date(Date.UTC(year!, month! - 1, day! - (WINDOW_DAYS - 1) + i))
    )
  );

  const byDay = new Map(
    rows.map((r) => [r.day, Math.max(0, Math.round(r.ml))] as const)
  );

  const days: WaterDay[] = dayKeys.map((dayKey) => {
    const ml = byDay.get(dayKey) ?? 0;
    return {
      dayKey,
      label: weekdayLabel(dayKey),
      ml,
      isToday: dayKey === todayKey,
      reached: ml >= goalMl,
    };
  });

  const todayMl = days[WINDOW_DAYS - 1]!.ml;
  const logged = days.filter((d) => d.ml > 0);
  const weekAvgMl =
    logged.length > 0
      ? Math.round(logged.reduce((s, d) => s + d.ml, 0) / logged.length)
      : 0;

  return {
    days,
    todayMl,
    goalMl,
    pct: goalMl > 0 ? Math.min(1, todayMl / goalMl) : 0,
    remainingMl: Math.max(0, goalMl - todayMl),
    reachedToday: todayMl >= goalMl,
    weekAvgMl,
    maxMl: Math.max(goalMl, ...days.map((d) => d.ml)),
    loggedDaysCount: logged.length,
  };
}
