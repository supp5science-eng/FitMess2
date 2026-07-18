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
