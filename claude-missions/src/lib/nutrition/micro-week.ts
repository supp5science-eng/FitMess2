/**
 * Analitika "Mikronutrijenti" card: pure, DB-free arithmetic that turns a
 * trailing week of logs into a per-nutrient 7-day series (fiber, total sugar,
 * sodium, saturated fat) measured against the day's targets.
 *
 * Same "money-math rule" as the rest of the app (`src/lib/nutrition/micro.ts`,
 * `src/lib/water/water-week.ts`): deterministic, unit-tested code computes every
 * number the card draws; the component only maps the domain onto pixels.
 *
 * ## The honesty rule this file exists to protect
 *
 * `null` means UNKNOWN, never zero (see `0017_micronutrients.sql`). On the home
 * tab that is per-DAY: a day whose entries have no fiber data shows "—". Here it
 * is per-day too, but with a twist a weekly chart makes unavoidable:
 *
 *   A day where only one of four meals carries fiber data would draw a short bar
 *   and read as "you barely ate fiber" -- a lie built out of a data gap.
 *
 * So a day only produces a value for a nutrient when the entries that DO carry
 * that nutrient cover at least `MIN_DAY_COVERAGE` of the day's calories.
 * Anything thinner is `null`: no bar, excluded from the average, counted in
 * `daysWithoutData` so the card can say so out loud.
 *
 * The window is the trailing 7 days ending today (like Voda/Koraci), not the
 * Mon–Sun calendar week the "Dnevni prosek kalorija" card uses -- these are
 * habits you read as "the last week", not as a week that resets on Monday.
 */

import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  MICRO_KEYS,
  MICRO_SPECS,
  resolveLogMicros,
  type MicroKey,
  type MicroLogInput,
  type MicroSpec,
  type MicroTargets,
} from "@/lib/nutrition/micro";
import { WEEKDAY_LABELS_SR } from "@/lib/week/summary";

const WINDOW_DAYS = 7;

/**
 * How much of a day's calories must carry a nutrient before that day's sum is
 * shown at all. Below this the bar would be mostly missing data, so the day
 * reports "unknown" instead. Same threshold the health score uses to decide it
 * can't grade a day.
 */
export const MIN_DAY_COVERAGE = 0.5;

/** Headroom above the tallest bar / target line so nothing touches the ceiling. */
const CHART_HEADROOM = 1.1;

/** A log row as this module needs it: the micro shape plus when it was eaten. */
export interface MicroWeekLogInput extends MicroLogInput {
  logged_at: string;
}

export interface MicroWeekDay {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Short Serbian weekday label, "Pon".."Ned". */
  label: string;
  isToday: boolean;
  /**
   * The day's amount for this nutrient, or `null` when the day has no logs or
   * too little of it is described (see `MIN_DAY_COVERAGE`). Whole units.
   */
  value: number | null;
  /** True when the day met a goal (fiber) or stayed under a limit. `false` for
   * a day with no value -- "we don't know" is never scored as a win. */
  inTarget: boolean;
  /** Fraction of the day's kcal that carried this nutrient (0..1). */
  coverage: number;
}

/** Where a week's average sits relative to the target. */
export type MicroWeekStatus = "no-data" | "under" | "ok" | "over";

export interface MicroNutrientWeek {
  key: MicroKey;
  spec: MicroSpec;
  /** The daily goal (fiber) or ceiling (the other three), whole units. */
  target: number;
  /** 7 days, oldest → today. */
  days: MicroWeekDay[];
  /** Mean across days WITH a value; `null` when no day had one. */
  average: number | null;
  /** Days that produced a value. */
  daysWithData: number;
  /** Days in the window that could not be measured (no logs, or too thin). */
  daysWithoutData: number;
  /** Days that met the goal / stayed under the limit. */
  daysInTarget: number;
  /**
   * Where `average` sits: "ok" (goal reached / under the ceiling), "under"
   * (short of the fiber goal), "over" (past a ceiling), "no-data".
   */
  status: MicroWeekStatus;
  /** Y-axis ceiling for the bars: clears both the tallest day and the target. */
  chartMax: number;
}

export interface MicroWeek {
  /** One entry per nutrient, in `MICRO_KEYS` order (the card's tab order). */
  nutrients: MicroNutrientWeek[];
  /** Days in the window with at least one logged entry. */
  loggedDaysCount: number;
  /** True when not a single day in the window produced any value at all --
   * the card then shows one calm empty state instead of four empty charts. */
  isEmpty: boolean;
}

function weekdayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay(); // Sun=0
  return WEEKDAY_LABELS_SR[(jsDay + 6) % 7]!;
}

interface DayBucket {
  kcal: number;
  /** Per nutrient: the running sum and the kcal it was computed from. */
  sums: Record<MicroKey, { value: number; coveredKcal: number }>;
  logCount: number;
}

function emptyBucket(): DayBucket {
  return {
    kcal: 0,
    sums: {
      fiber: { value: 0, coveredKcal: 0 },
      sugar: { value: 0, coveredKcal: 0 },
      sodium: { value: 0, coveredKcal: 0 },
      satFat: { value: 0, coveredKcal: 0 },
    },
    logCount: 0,
  };
}

/**
 * Buckets a trailing window of logs into a per-nutrient 7-day series.
 * `targets` are the day's derived numbers (`microTargetsForKcal`), applied to
 * every day in the window -- the same simplification the rest of Analitika
 * makes when a target changes mid-week.
 */
export function computeMicroWeek(
  logs: MicroWeekLogInput[],
  now: Date,
  targets: MicroTargets
): MicroWeek {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const dayKeys = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    toBelgradeCalendarDay(
      new Date(Date.UTC(year!, month! - 1, day! - (WINDOW_DAYS - 1) + i))
    )
  );
  const inWindow = new Set(dayKeys);

  const byDay = new Map<string, DayBucket>();
  for (const log of logs) {
    const dayKey = toBelgradeCalendarDay(new Date(log.logged_at));
    if (!inWindow.has(dayKey)) continue;

    const bucket = byDay.get(dayKey) ?? emptyBucket();
    const kcal = Number.isFinite(log.kcal) ? Math.max(0, log.kcal) : 0;
    bucket.kcal += kcal;
    bucket.logCount += 1;

    // Snapshot first, catalog per-100g as the fallback -- exactly what the home
    // cards resolve, so the two screens can never disagree about a meal.
    const micros = resolveLogMicros(log);
    for (const key of MICRO_KEYS) {
      const value = micros[key];
      if (value === null) continue;
      bucket.sums[key].value += value;
      bucket.sums[key].coveredKcal += kcal;
    }
    byDay.set(dayKey, bucket);
  }

  const nutrients = MICRO_KEYS.map((key) => {
    const spec = MICRO_SPECS[key];
    const target = Math.max(0, Math.round(targets[key] ?? 0));

    const days: MicroWeekDay[] = dayKeys.map((dayKey) => {
      const bucket = byDay.get(dayKey);
      const sum = bucket?.sums[key];
      const coverage =
        bucket && bucket.kcal > 0 && sum
          ? Math.min(1, sum.coveredKcal / bucket.kcal)
          : 0;
      // A day is measurable only when enough of it is described. Everything
      // else is honestly unknown -- never a confident zero.
      const measurable =
        bucket !== undefined &&
        sum !== undefined &&
        sum.coveredKcal > 0 &&
        coverage >= MIN_DAY_COVERAGE;
      const value = measurable ? Math.round(sum.value) : null;

      return {
        dayKey,
        label: weekdayLabel(dayKey),
        isToday: dayKey === todayKey,
        value,
        inTarget:
          value === null
            ? false
            : spec.kind === "goal"
              ? value >= target
              : value <= target,
        coverage,
      };
    });

    const measured = days.filter((d) => d.value !== null);
    const average =
      measured.length > 0
        ? Math.round(
            measured.reduce((sum, d) => sum + (d.value ?? 0), 0) /
              measured.length
          )
        : null;

    const status: MicroWeekStatus =
      average === null
        ? "no-data"
        : spec.kind === "goal"
          ? average >= target
            ? "ok"
            : "under"
          : average <= target
            ? "ok"
            : "over";

    const tallest = Math.max(0, ...measured.map((d) => d.value ?? 0));
    const chartMax = Math.max(1, Math.ceil(Math.max(target, tallest) * CHART_HEADROOM));

    return {
      key,
      spec,
      target,
      days,
      average,
      daysWithData: measured.length,
      daysWithoutData: WINDOW_DAYS - measured.length,
      daysInTarget: days.filter((d) => d.inTarget).length,
      status,
      chartMax,
    };
  });

  return {
    nutrients,
    loggedDaysCount: dayKeys.filter((k) => (byDay.get(k)?.logCount ?? 0) > 0)
      .length,
    isEmpty: nutrients.every((n) => n.daysWithData === 0),
  };
}
