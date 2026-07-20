/**
 * F027 / AS-047, AS-048, AS-050: pure, DB-free arithmetic for the home
 * screen -- summing today's logged kcal/macros and deriving the ring's
 * "remaining" (or "overshoot") number. Same "money-math rule" posture as
 * `src/lib/budget/engine.ts` and `src/lib/food/portions.ts`: deterministic
 * code computes every number shown to the user, nothing is eyeballed in a
 * component.
 */

export interface DayTotalsInput {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * AS-048/AS-049: sums today's logged kcal + macros across every log row.
 * An empty list sums to all-zero (the empty-state day), never throws.
 */
export function computeDayTotals(logs: DayTotalsInput[]): DayTotals {
  return logs.reduce<DayTotals>(
    (totals, log) => ({
      kcal: totals.kcal + log.kcal,
      protein: totals.protein + log.protein,
      carbs: totals.carbs + log.carbs,
      fat: totals.fat + log.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export interface RemainingResult {
  /** Whole kcal remaining today, never negative (0 once over budget). */
  remainingKcal: number;
  /** True once consumed kcal meets or exceeds the daily target (AS-050). */
  isOver: boolean;
  /** Whole kcal consumed beyond the daily target; 0 while under budget. */
  overshootKcal: number;
}

/**
 * AS-047 (remaining) / AS-050 (overshoot): derives the ring's single
 * headline number from consumed vs. target daily kcal. Rounds to whole kcal
 * (matches `src/lib/budget/engine.ts`'s "kcal values are always whole
 * numbers" rounding rule) so the UI never shows a fractional calorie.
 *
 * A non-positive `targetKcal` (no target set yet, or a defensive guard
 * against bad data) is treated as "nothing to be over" -- remaining is
 * clamped to 0 rather than producing a nonsensical negative-target overshoot
 * (callers should prefer their own "no target set" empty state instead of
 * calling this with `targetKcal <= 0`, but this must never throw).
 */
export function computeRemaining(
  consumedKcal: number,
  targetKcal: number
): RemainingResult {
  const safeTarget = Math.max(0, targetKcal);
  const safeConsumed = Math.max(0, consumedKcal);
  const remaining = safeTarget - safeConsumed;

  if (remaining >= 0) {
    return {
      remainingKcal: Math.round(remaining),
      isOver: false,
      overshootKcal: 0,
    };
  }

  return {
    remainingKcal: 0,
    isOver: true,
    overshootKcal: Math.round(-remaining),
  };
}

/**
 * Ring colour level, driven by how much of the daily budget is LEFT
 * (2026-07-20 product decision -- the "zero-shame, never red" gauge is
 * replaced by an at-a-glance traffic-light):
 *   - green:  more than 50% of the day's kcal budget still remaining
 *   - yellow: 15%..50% remaining (getting close)
 *   - red:    under 15% remaining, including at/over the limit
 */
export type RingLevel = "green" | "yellow" | "red";

export interface RingState {
  /** Whole kcal consumed today (>= 0). */
  consumedKcal: number;
  /** Whole daily target kcal (>= 0). */
  targetKcal: number;
  /**
   * SIGNED whole kcal remaining (target - consumed) -- NEGATIVE once over the
   * limit, so the UI can show exactly how far into the minus the user is
   * (e.g. -500), rather than clamping to 0.
   */
  remainingKcal: number;
  /** True once consumed meets or exceeds the daily target. */
  isOver: boolean;
  /** Whole kcal consumed beyond the target; 0 while under budget. */
  overshootKcal: number;
  /** Traffic-light colour level for the gauge stroke. */
  level: RingLevel;
  /** Consumed / target, clamped to [0, 1] -- fills the first lap of the gauge. */
  fillFraction: number;
  /**
   * Overshoot / target, clamped to [0, 1] -- draws the SECOND lap on top of a
   * full first lap once over the limit (0 while under budget).
   */
  overshootFraction: number;
}

/**
 * Derives everything the calorie gauge needs from consumed vs. target kcal:
 * the signed remaining number, the traffic-light colour level (green >50%
 * left, yellow 15-50%, red <15%/over), and the two fill fractions (the first
 * lap fills with consumption; a second lap draws once over the limit). Whole
 * kcal throughout (same money-math rounding as `computeRemaining`). Never
 * throws -- a non-positive target degrades to a safe "red, nothing left"
 * state (callers should still prefer their own "no target set" empty state).
 */
export function computeRingState(
  consumedKcal: number,
  targetKcal: number
): RingState {
  const safeConsumed = Math.max(0, consumedKcal);
  const safeTarget = Math.max(0, targetKcal);
  const denom = safeTarget > 0 ? safeTarget : 1;

  const signedRemaining = safeTarget - safeConsumed;
  const isOver = signedRemaining < 0;
  const overshoot = isOver ? -signedRemaining : 0;
  const remainingFraction = signedRemaining / denom;

  let level: RingLevel;
  if (remainingFraction > 0.5) {
    level = "green";
  } else if (remainingFraction > 0.15) {
    level = "yellow";
  } else {
    level = "red";
  }

  return {
    consumedKcal: Math.round(safeConsumed),
    targetKcal: Math.round(safeTarget),
    remainingKcal: Math.round(signedRemaining),
    isOver,
    overshootKcal: Math.round(overshoot),
    level,
    fillFraction: Math.min(1, Math.max(0, safeConsumed / denom)),
    overshootFraction: Math.min(1, Math.max(0, overshoot / denom)),
  };
}
