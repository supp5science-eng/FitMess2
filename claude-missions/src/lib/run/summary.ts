/**
 * Trčanje (F-runs): the one entry point that turns a raw GPS trace into every
 * number a run is stored and shown with — distance, active duration, average
 * pace, per-km splits, and calories.
 *
 * The API route (src/app/api/trcanje/route.ts) calls this on the server so the
 * persisted totals are authoritative (never trusted from the client), and the
 * recording/detail screens call the same function so what you see mid-run and
 * afterwards is computed identically. All segment filtering happens once here.
 */

import { computeRunCalories } from "@/lib/run/calories";
import {
  sumActiveSeconds,
  sumDistanceM,
  toRunSegments,
} from "@/lib/run/distance";
import {
  computeSplitsFromSegments,
  paceSecPerKm,
  type Split,
} from "@/lib/run/pace";
import type { RunRoutePoint } from "@/lib/types/db";

export interface RunSummary {
  /** Total moving distance, whole metres. */
  distanceM: number;
  /** Active (moving) seconds, excluding paused gaps. */
  durationS: number;
  /** Average pace in sec/km, or `null` for a zero-distance run. */
  paceSecPerKm: number | null;
  /** Whole kcal burned (folds into the day's calorie budget). */
  calories: number;
  /** Per-kilometre breakdown for the splits chart. */
  splits: Split[];
}

/**
 * Compute the full summary of a run from its trace and the runner's body
 * weight. Distance and duration come from the same trusted moving segments the
 * splits do, so they can't disagree; calories are distance-based. A trace with
 * no usable movement summarises to an all-zero run (never throws).
 */
export function computeRunSummary(
  points: readonly RunRoutePoint[],
  weightKg?: number | null
): RunSummary {
  const segments = toRunSegments(points);
  const distanceM = Math.round(sumDistanceM(segments));
  const durationS = Math.round(sumActiveSeconds(segments));

  return {
    distanceM,
    durationS,
    paceSecPerKm: paceSecPerKm(distanceM, durationS),
    calories: computeRunCalories(distanceM, weightKg),
    splits: computeSplitsFromSegments(segments),
  };
}
