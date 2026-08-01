/**
 * Nedeljno merenje: the Analitika chart model -- raw weigh-ins plus the smooth
 * line drawn through them.
 *
 * Both, always. The dots are the truth: what the scale actually said, water
 * weight and all. The line is what the plan is judged against, and it is the
 * SAME least-squares fit `weekly-trend.ts` uses to decide whether to suggest a
 * correction -- imported rather than reimplemented, because a chart that
 * disagreed with the card underneath it would make both untrustworthy.
 *
 * Showing only the line would hide how noisy real weigh-ins are, and a user who
 * has never seen that noise reads every 0.8 kg morning as a verdict. Showing
 * only the dots would leave them to eyeball a trend out of four scattered
 * points, which is the exact task humans are worst at.
 *
 * Pure and DB-free; the caller supplies the rows.
 */

import { fitAt, fitSlopeKgPerDay, type WeighInPoint } from "@/lib/weight/weekly-trend";

const SR_MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
];

export interface WeighInChartPoint {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Short label for the axis / read-out: `"2. avg"`. */
  label: string;
  weightKg: number;
  /** Horizontal position 0..1, proportional to the DATE -- not to the index,
   * so a fortnight's gap between two weigh-ins looks like a fortnight. */
  x: number;
  /** The fitted line's value on this day, for the smooth overlay. */
  fittedKg: number;
}

export interface WeighInChart {
  points: WeighInChartPoint[];
  /** Chart bounds, padded so the line never touches the frame. */
  minKg: number;
  maxKg: number;
  /** Fitted change across the whole window (end - start), kg. */
  changeKg: number;
  /** Fitted weekly rate, kg/week (negative = losing). */
  trendKgPerWeek: number;
  /** Newest weigh-in. */
  currentKg: number;
  spanDays: number;
}

/** Whole days between two `"YYYY-MM-DD"` keys. */
function dayDiff(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00.000Z`);
  const end = Date.parse(`${b}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

function shortLabel(dayKey: string): string {
  const [, month, day] = dayKey.split("-").map(Number);
  return `${day}. ${SR_MONTHS_SHORT[month! - 1]}`;
}

/**
 * Builds the chart, or `null` when there is nothing worth drawing -- fewer than
 * two weigh-ins is a dot, not a trend, and the card says so in words instead.
 */
export function computeWeighInChart(
  weighIns: readonly WeighInPoint[]
): WeighInChart | null {
  const byDay = new Map<string, WeighInPoint>();
  for (const point of weighIns) {
    if (!Number.isFinite(point.weightKg) || point.weightKg <= 0) continue;
    byDay.set(point.day, point);
  }
  const sorted = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < 2) return null;

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const spanDays = dayDiff(first.day, last.day);
  if (spanDays <= 0) return null;

  const raw = sorted.map((point) => ({
    x: dayDiff(first.day, point.day),
    y: point.weightKg,
  }));
  const slope = fitSlopeKgPerDay(raw);

  const points: WeighInChartPoint[] = sorted.map((point, i) => ({
    dayKey: point.day,
    label: shortLabel(point.day),
    weightKg: point.weightKg,
    x: raw[i]!.x / spanDays,
    fittedKg: fitAt(raw, raw[i]!.x),
  }));

  // Bounds cover the dots AND the line, then get a little air so a flat week
  // does not render as a stripe glued to the top of the box.
  const values = points.flatMap((point) => [point.weightKg, point.fittedKg]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.15, 0.3);

  return {
    points,
    minKg: rawMin - pad,
    maxKg: rawMax + pad,
    changeKg:
      Math.round((points[points.length - 1]!.fittedKg - points[0]!.fittedKg) * 100) /
      100,
    trendKgPerWeek: Math.round(slope * 7 * 100) / 100,
    currentKg: last.weightKg,
    spanDays,
  };
}
