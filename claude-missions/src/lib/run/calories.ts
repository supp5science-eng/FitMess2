/**
 * Trčanje (F-runs): pure calorie arithmetic for a run — how many kcal the run
 * burned, shown on the recording + summary screens. It stays a standalone run
 * stat (a product decision): it is NOT folded into the food calorie budget on
 * `/danas`/`/analitika`, which tracks intake separately.
 *
 * Running energy cost is dominated by distance and body mass, not speed: to a
 * good approximation you burn a near-constant amount of energy per kilogram per
 * kilometre regardless of how fast you cover it. We use that distance × weight
 * model (rather than a speed/MET table) because it stays stable under noisy GPS
 * pace and needs only the one body-stat FitMess already stores.
 */

/**
 * Net energy cost of running, kcal per kg of body mass per km covered. ~1.03 is
 * the commonly cited running economy for level ground; a heavier or lighter
 * runner scales linearly with their weight.
 */
export const KCAL_PER_KG_PER_KM = 1.036;

/** Fallback body weight (kg) when the profile has none yet, so a run still
 * logs a sensible calorie figure instead of zero. */
export const DEFAULT_WEIGHT_KG = 70;

/** Clamp a body weight to a sane human range; non-finite/≤0 → the default. */
function safeWeightKg(weightKg: number | null | undefined): number {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return DEFAULT_WEIGHT_KG;
  }
  return Math.min(300, Math.max(30, weightKg));
}

/**
 * Whole kcal burned over `distanceM` metres for a runner of `weightKg`.
 * Distance-based, so a paused or GPS-jittery run can't distort it. Rounds to a
 * whole calorie (the budget never shows fractional kcal) and never returns
 * negative.
 */
export function computeRunCalories(
  distanceM: number,
  weightKg?: number | null
): number {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 0;
  const km = distanceM / 1000;
  return Math.round(km * safeWeightKg(weightKg) * KCAL_PER_KG_PER_KM);
}
