/**
 * "Šta da jedeš danas" (2026-07-28): the matcher. Given a slot and a target
 * (kcal + protein) for one meal, it scores every curated template for that
 * slot, scales the best fits toward the target, and returns them ranked. The
 * top result is the shown suggestion; the rest feed the "Promeni" swap, which
 * cycles the list -- so every alternative is still a curated healthy meal, per
 * the product owner's rule (never suggest junk, swap stays healthy).
 *
 * Pure and DB-free (money-math rule): no I/O, no wall-clock, no randomness --
 * identical input yields an identical ranking, so it is fully unit-testable.
 */

import {
  mealsForSlot,
  scaleMeal,
  type DietTag,
  type MealSlot,
  type ScaledMeal,
} from "@/lib/plan/healthy-meals";

/** What one suggested meal is aiming for: a kcal size and a protein floor. */
export interface SlotTarget {
  kcal: number;
  proteinG: number;
}

export interface RankOptions {
  /** Template ids to leave out (already suggested elsewhere / dismissed). */
  excludeIds?: string[];
  /** Dietary tags to avoid -- a template carrying any of these is dropped.
   * Empty/absent (v1: no stored prefs) keeps the whole catalog. */
  avoidTags?: DietTag[];
  /** How many ranked suggestions to return (default 4, for swap cycling). */
  limit?: number;
}

/**
 * Protein weight in the score. Hitting the protein floor is the whole job of a
 * suggested meal (it is the macro that must be reached, not merely approached),
 * so each gram off target costs `PROTEIN_WEIGHT` points; each kcal off costs
 * `1 / KCAL_DIVISOR`. With the values below, being 10 g short on protein
 * outweighs being 100 kcal off -- protein leads, kcal breaks ties.
 */
export const PROTEIN_WEIGHT = 3;
export const KCAL_DIVISOR = 10;

/** Lower is better: weighted distance from a scaled meal to the slot target. */
export function scoreMeal(meal: ScaledMeal, target: SlotTarget): number {
  const proteinDiff = Math.abs(meal.macros.proteinG - target.proteinG);
  const kcalDiff = Math.abs(meal.macros.kcal - target.kcal);
  return proteinDiff * PROTEIN_WEIGHT + kcalDiff / KCAL_DIVISOR;
}

/**
 * Ranks the curated templates for `slot`, each scaled toward `target.kcal`, by
 * how well they fit `target` (protein-first). Returns the best `limit` as
 * `ScaledMeal`s. Deterministic: ties keep catalog order (a stable sort on a
 * stable input).
 */
export function rankSuggestionsForSlot(
  slot: MealSlot,
  target: SlotTarget,
  options: RankOptions = {}
): ScaledMeal[] {
  const { excludeIds = [], avoidTags = [], limit = 4 } = options;
  const exclude = new Set(excludeIds);
  const avoid = new Set(avoidTags);

  const scored = mealsForSlot(slot)
    .filter((template) => !exclude.has(template.id))
    .filter((template) => !template.tags.some((tag) => avoid.has(tag)))
    .map((template) => {
      const meal = scaleMeal(template, target.kcal);
      return { meal, score: scoreMeal(meal, target) };
    })
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, Math.max(1, limit)).map((entry) => entry.meal);
}
