/**
 * Analitika "Procena težine" card: pure, DB-free arithmetic that estimates a
 * weight trend from CALORIE INTAKE rather than from scale weigh-ins.
 *
 * The idea: every day you eat below your maintenance (TDEE) you lose a little,
 * above it you gain a little. Cumulative energy balance ÷ ~7700 kcal/kg (the
 * energy density of body mass, the same `KCAL_PER_KG_BODY_MASS` the budget
 * engine uses for goal pacing) turns "what you ate" into "estimated weight
 * movement". It complements the real weigh-in trend -- especially useful before
 * the user has logged many weigh-ins.
 *
 * Same "money-math rule" as the rest of the app: deterministic code computes
 * every number the card draws; the SVG only maps the domain onto pixels, and
 * the Serbian copy lives in the component (this module returns a `noteKind`).
 *
 * The line is anchored so TODAY equals the user's current known weight and the
 * previous 6 days are back-projected from each day's balance -- so the endpoint
 * is real and the slope shows how the week's eating moved the estimate there.
 * Days with no logs contribute zero balance (treated as maintenance), so an
 * untracked day never fabricates a change.
 */

import { KCAL_PER_KG_BODY_MASS } from "@/lib/budget/engine";
import { toBelgradeCalendarDay } from "@/lib/dates";

/** Minimal log shape this module needs (a subset of a `logs` row). */
export interface IntakeLogInput {
  logged_at: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface IntakeTrendPoint {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  dayKey: string;
  /** Estimated weight (kg) on this day, anchored to today's real weight. */
  estWeightKg: number;
  /** True if at least one log landed on this day. */
  hasLog: boolean;
  /** Horizontal position 0..1 across the 7-day window. */
  x: number;
}

/** Which nutrition insight to surface; the Serbian copy lives in the UI. */
export type IntakeNoteKind =
  | "no_data"
  | "fat_high"
  | "protein_low"
  | "surplus"
  | "on_track";

export interface IntakeTrend {
  /** 7 points, oldest → today. */
  points: IntakeTrendPoint[];
  /** Net estimated weight change across the window (last − first), kg 1dp;
   * negative = estimated loss, positive = estimated gain. */
  estChangeKg: number;
  /** Days with at least one log in the window. */
  loggedDaysCount: number;
  /** Mean daily energy balance over LOGGED days (kcal; consumed − TDEE). */
  avgBalanceKcal: number;
  /** y-domain bounds (kg) for the sparkline, padded, with a floor span. */
  minKg: number;
  maxKg: number;
  /** Nutrition insight for the card's side note. */
  noteKind: IntakeNoteKind;
}

export interface IntakeTrendParams {
  /** Maintenance calories (BMR × activity) from the budget engine. */
  tdeeKcal: number;
  /** Current known weight (latest weigh-in, else the profile weight), kg. */
  currentWeightKg: number;
  /** Newest target's fat/protein grams, for the nutrition note; may be null. */
  targetFatG: number | null;
  targetProteinG: number | null;
}

const WINDOW_DAYS = 7;
const Y_PAD_KG = 0.3;
const MIN_Y_SPAN_KG = 1;
/** Above this average daily surplus we flag "eating over maintenance". */
const SURPLUS_KCAL = 150;
/** Fat is "high" once the daily average exceeds the target by this factor. */
const FAT_HIGH_FACTOR = 1.2;
/** Protein is "low" once the daily average drops below this fraction of target. */
const PROTEIN_LOW_FACTOR = 0.8;

function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

interface DayBucket {
  kcal: number;
  protein: number;
  fat: number;
}

/**
 * Estimates a 7-day weight trend from a window of logs and the user's TDEE.
 * `now` defaults to the current instant; pass it for deterministic tests.
 */
export function computeIntakeTrend(
  logs: IntakeLogInput[],
  now: Date,
  params: IntakeTrendParams
): IntakeTrend {
  const { tdeeKcal, currentWeightKg, targetFatG, targetProteinG } = params;

  // The 7 Belgrade day keys of the window, oldest → today.
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const dayKeys = Array.from({ length: WINDOW_DAYS }, (_, i) =>
    toBelgradeCalendarDay(
      new Date(Date.UTC(year!, month! - 1, day! - (WINDOW_DAYS - 1) + i))
    )
  );

  // Bucket each log onto its Belgrade calendar day.
  const byDay = new Map<string, DayBucket>();
  for (const log of logs) {
    const key = toBelgradeCalendarDay(new Date(log.logged_at));
    const bucket = byDay.get(key) ?? { kcal: 0, protein: 0, fat: 0 };
    bucket.kcal += log.kcal;
    bucket.protein += log.protein;
    bucket.fat += log.fat;
    byDay.set(key, bucket);
  }

  // Per-day energy balance (0 on untracked days = maintenance, no fabricated
  // movement) and macro totals for the nutrition note.
  const balances = dayKeys.map((key) => {
    const bucket = byDay.get(key);
    if (!bucket) return 0;
    return bucket.kcal - tdeeKcal;
  });
  const hasLog = dayKeys.map((key) => byDay.has(key));

  // Back-project weights: today = current weight; each earlier day removes the
  // NEXT day's balance (weight[i] = weight[i+1] − balance[i+1] / kcalPerKg).
  const estWeights = new Array<number>(WINDOW_DAYS);
  estWeights[WINDOW_DAYS - 1] = currentWeightKg;
  for (let i = WINDOW_DAYS - 2; i >= 0; i--) {
    estWeights[i] =
      estWeights[i + 1]! - balances[i + 1]! / KCAL_PER_KG_BODY_MASS;
  }

  const minEst = Math.min(...estWeights);
  const maxEst = Math.max(...estWeights);
  let lo = minEst - Y_PAD_KG;
  let hi = maxEst + Y_PAD_KG;
  if (hi - lo < MIN_Y_SPAN_KG) {
    const mid = (hi + lo) / 2;
    lo = mid - MIN_Y_SPAN_KG / 2;
    hi = mid + MIN_Y_SPAN_KG / 2;
  }

  const points: IntakeTrendPoint[] = dayKeys.map((dayKey, i) => ({
    dayKey,
    estWeightKg: round1(estWeights[i]!),
    hasLog: hasLog[i]!,
    x: i / (WINDOW_DAYS - 1),
  }));

  const estChangeKg = round1(
    estWeights[WINDOW_DAYS - 1]! - estWeights[0]!
  );

  // Nutrition note, computed over LOGGED days only.
  const loggedKeys = dayKeys.filter((key) => byDay.has(key));
  const loggedDaysCount = loggedKeys.length;

  let avgBalanceKcal = 0;
  let noteKind: IntakeNoteKind = "no_data";
  if (loggedDaysCount > 0) {
    const sumBalance = dayKeys.reduce(
      (sum, key, i) => (byDay.has(key) ? sum + balances[i]! : sum),
      0
    );
    avgBalanceKcal = Math.round(sumBalance / loggedDaysCount);

    const avgFat =
      loggedKeys.reduce((s, k) => s + (byDay.get(k)?.fat ?? 0), 0) /
      loggedDaysCount;
    const avgProtein =
      loggedKeys.reduce((s, k) => s + (byDay.get(k)?.protein ?? 0), 0) /
      loggedDaysCount;

    if (targetFatG != null && avgFat > targetFatG * FAT_HIGH_FACTOR) {
      noteKind = "fat_high";
    } else if (
      targetProteinG != null &&
      avgProtein < targetProteinG * PROTEIN_LOW_FACTOR
    ) {
      noteKind = "protein_low";
    } else if (avgBalanceKcal > SURPLUS_KCAL) {
      noteKind = "surplus";
    } else {
      noteKind = "on_track";
    }
  }

  return {
    points,
    estChangeKg,
    loggedDaysCount,
    avgBalanceKcal,
    minKg: round1(lo),
    maxKg: round1(hi),
    noteKind,
  };
}
