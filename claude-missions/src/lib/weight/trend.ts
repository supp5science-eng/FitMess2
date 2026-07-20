/**
 * F042/F043: pure, DB-free arithmetic for the weight-trend chart on
 * `/analitika`.
 *
 * Same "money-math rule" posture as `src/lib/week/summary.ts`: deterministic
 * code computes every number the chart draws -- the raw points, the 7-day
 * rolling average line, the y-domain, and the goal delta -- nothing is
 * eyeballed in the SVG component. Takes the user's weigh-ins (each a Belgrade
 * calendar `day` "YYYY-MM-DD" plus a `weight_kg`), the goal weight (from the
 * newest `targets` row, may be null), and "now", and returns a fully derived
 * `WeightTrend` the chart renders directly.
 *
 * The headline signal is the ROLLING AVERAGE, not any single day: body weight
 * swings a kilo or two day-to-day from water/food/sleep, so a single scary
 * reading is noise. The average is what actually moves toward the goal --
 * same "one bad day looks small against the whole" philosophy the weekly
 * dashboard uses, applied to weight. That is why the average line is the
 * prominent element and raw points are muted (see the chart component).
 *
 * Rolling average is a CALENDAR window, not a "last N points" window: for
 * each weigh-in day D, average every weigh-in whose day falls in the inclusive
 * range [D - 6 days, D]. This is gap-robust -- weighing 2-3x/week gives 2-3
 * samples per window, and the line stays smooth across days with no reading.
 *
 * Day arithmetic is done on the `"YYYY-MM-DD"` strings via `Date.UTC` (the
 * same technique `belgradeWeekDayKeys` in `src/lib/dates.ts` uses); there are
 * no timezone concerns here because `day` is already a Belgrade calendar day,
 * never a UTC instant.
 */

import { toBelgradeCalendarDay } from "@/lib/dates";

export interface WeighInForTrend {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  weight_kg: number;
}

export interface TrendPoint {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  /** The raw weigh-in for this day (kg, one decimal). */
  weightKg: number;
  /** Mean of every weigh-in in the 7-calendar-day window ending on `day`
   * (kg, one decimal). With a single point this equals `weightKg`. */
  rollingAvgKg: number;
  /** Horizontal position on the time axis, 0..1, proportional to how far
   * `day` sits between the first and last weigh-in day (so gaps between
   * weigh-ins show as real horizontal distance). Single-point case -> 0.5. */
  x: number;
}

export interface WeightTrend {
  /** Weigh-ins as trend points, sorted ascending by day (deduped per day). */
  points: TrendPoint[];
  /** Most recent raw weigh-in (kg), or null if there are none. */
  latestWeightKg: number | null;
  /** Most recent rolling-average value (kg), or null if there are none. */
  latestAvgKg: number | null;
  /** The goal weight passed in (kg), or null. */
  goalWeightKg: number | null;
  /** `latestAvgKg - goalWeightKg`, one decimal (positive = still above the
   * goal, negative = below it); null if either value is missing. */
  deltaToGoalKg: number | null;
  /** y-axis lower bound (kg) -- includes the goal line, padded. */
  minKg: number;
  /** y-axis upper bound (kg) -- includes the goal line, padded. */
  maxKg: number;
  /** First weigh-in day, `"YYYY-MM-DD"`, or null. */
  firstDay: string | null;
  /** Last weigh-in day, `"YYYY-MM-DD"`, or null. */
  lastDay: string | null;
}

/** Rolling-average window length, in calendar days (inclusive of the day). */
const WINDOW_DAYS = 7;
/** Padding added above/below the data (and goal) for the y-domain, in kg. */
const Y_PAD_KG = 0.5;
/** Minimum y-domain span (kg) so a flat/near-flat series isn't a razor line. */
const MIN_Y_SPAN_KG = 2;

/** Whole days between two `"YYYY-MM-DD"` calendar days (b - a); may be negative. */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay!, am! - 1, ad!);
  const bMs = Date.UTC(by!, bm! - 1, bd!);
  return Math.round((bMs - aMs) / 86_400_000);
}

/** Rounds to one decimal, avoiding binary-float noise (e.g. 82.25 -> 82.3). */
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Buckets a set of weigh-ins into a fully-derived `WeightTrend`.
 *
 * `weighIns` may arrive in any order and may contain more than one row per
 * day (defensive -- the DB has a unique (user_id, day), so in practice one);
 * the LAST-seen value for a day wins after sorting, then the series is one
 * point per day ascending. Empty input yields empty points, null latest
 * values, and a safe (never-empty) y-domain -- this never throws, mirroring
 * `computeWeekSummary`'s defensive posture.
 */
export function computeWeightTrend(
  weighIns: WeighInForTrend[],
  goalWeightKg: number | null,
  now: Date = new Date()
): WeightTrend {
  void now; // reserved for future "is today" labelling; kept for signature parity

  // One weigh-in per day (last wins), sorted ascending by day.
  const byDay = new Map<string, number>();
  for (const w of weighIns) {
    byDay.set(w.day, w.weight_kg);
  }
  const days = Array.from(byDay.keys()).sort();

  const safeGoal =
    goalWeightKg != null && Number.isFinite(goalWeightKg)
      ? round1(goalWeightKg)
      : null;

  if (days.length === 0) {
    // No data: a calm empty y-domain centred on the goal (if any) so the
    // chart component can still draw a goal line without NaNs.
    const centre = safeGoal ?? 70;
    return {
      points: [],
      latestWeightKg: null,
      latestAvgKg: null,
      goalWeightKg: safeGoal,
      deltaToGoalKg: null,
      minKg: round1(centre - MIN_Y_SPAN_KG / 2),
      maxKg: round1(centre + MIN_Y_SPAN_KG / 2),
      firstDay: null,
      lastDay: null,
    };
  }

  const firstDay = days[0]!;
  const lastDay = days[days.length - 1]!;
  const span = dayDiff(firstDay, lastDay); // 0 when single point / same day

  const points: TrendPoint[] = days.map((day) => {
    const weightKg = round1(byDay.get(day)!);

    // Rolling average: mean of every weigh-in in [day - 6, day].
    let sum = 0;
    let count = 0;
    for (const other of days) {
      const back = dayDiff(other, day); // >= 0 means `other` is at/before `day`
      if (back >= 0 && back < WINDOW_DAYS) {
        sum += byDay.get(other)!;
        count += 1;
      }
    }
    const rollingAvgKg = round1(sum / count);

    const x = span === 0 ? 0.5 : dayDiff(firstDay, day) / span;

    return { day, weightKg, rollingAvgKg, x };
  });

  const latestPoint = points[points.length - 1]!;
  const latestWeightKg = latestPoint.weightKg;
  const latestAvgKg = latestPoint.rollingAvgKg;
  const deltaToGoalKg =
    safeGoal != null ? round1(latestAvgKg - safeGoal) : null;

  // y-domain: cover every raw point AND the goal line, pad, enforce min span.
  let lo = Math.min(...points.map((p) => p.weightKg));
  let hi = Math.max(...points.map((p) => p.weightKg));
  if (safeGoal != null) {
    lo = Math.min(lo, safeGoal);
    hi = Math.max(hi, safeGoal);
  }
  lo -= Y_PAD_KG;
  hi += Y_PAD_KG;
  if (hi - lo < MIN_Y_SPAN_KG) {
    const mid = (hi + lo) / 2;
    lo = mid - MIN_Y_SPAN_KG / 2;
    hi = mid + MIN_Y_SPAN_KG / 2;
  }

  return {
    points,
    latestWeightKg,
    latestAvgKg,
    goalWeightKg: safeGoal,
    deltaToGoalKg,
    minKg: round1(lo),
    maxKg: round1(hi),
    firstDay,
    lastDay,
  };
}

/**
 * Formats a Belgrade calendar day `"YYYY-MM-DD"` as a short axis label, e.g.
 * `15. jul`. Returns `danas` for today's Belgrade day so the newest point on
 * the chart reads naturally. Kept here (not in the component) so the "is
 * today" decision uses the same Belgrade-calendar frame as everything else
 * and is computed once on the server, avoiding client/server clock drift.
 */
export function formatTrendDayLabel(
  day: string,
  now: Date = new Date()
): string {
  if (day === toBelgradeCalendarDay(now)) return "danas";
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year!, month! - 1, dayOfMonth!)));
}
