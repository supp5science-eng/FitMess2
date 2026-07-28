/**
 * "Šta da jedeš danas" (2026-07-28): the daily meal plan.
 *
 * The model (science, in tested code -- the same posture as
 * `src/lib/budget/engine.ts` and `src/lib/home/adaptive.ts`):
 *  - The day's kcal budget is the CEILING; the plan never raises it.
 *  - We suggest 1-2 protein-forward meals whose job is to secure the day's
 *    PROTEIN floor. Protein is the macro a cut most reliably misses and the one
 *    that preserves muscle + satiety, so it is front-loaded into the suggested
 *    meals; each targets ~0.35-0.45 of the daily protein, i.e. a per-meal dose
 *    in the ~0.4 g/kg range research ties to maximal muscle-protein synthesis.
 *  - Whatever kcal the suggested meals do NOT reserve is the FREE third meal:
 *    eat anything, as long as the day stays under the ceiling.
 *
 * "Done" detection is deliberately simple and monotonic (v1): a suggested meal
 * counts as covered once the day's CONSUMED protein reaches that meal's
 * cumulative protein target. It reads protein already logged today -- exactly
 * the "based on what they've eaten" signal -- without trying to cluster
 * individual log rows into meals (that per-meal grouping is a v2 refinement).
 *
 * Pure, DB-free arithmetic. `computeMealPlan` additionally asks the matcher
 * (`suggest.ts`) for ranked healthy suggestions for each not-yet-covered meal.
 */

import type { MacroVector, MealSlot, ScaledMeal, DietTag } from "@/lib/plan/healthy-meals";
import { slotForLoggedName } from "@/lib/plan/healthy-meals";
import { rankSuggestionsForSlot } from "@/lib/plan/suggest";

/** The user's daily targets this plan is built against. */
export interface PlanTarget {
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealPlanInput {
  target: PlanTarget;
  /** Today's consumed totals so far (from `computeDayTotals`). */
  consumed: MacroVector;
  /** Names of today's logged entries. A logged entry whose name matches a
   * curated template marks that template's slot as covered -- so a suggestion
   * you added via "Dodaj u dnevnik" flips to done immediately. */
  loggedMealNames?: string[];
  /** Dietary tags to avoid in suggestions (v1: usually empty). */
  avoidTags?: DietTag[];
  /** Ranked suggestions kept per meal, for the "Promeni" swap (default 4). */
  suggestionsPerSlot?: number;
}

/** The set of slots already covered by a logged suggestion (name match). */
function coveredSlotsFrom(names: string[]): Set<MealSlot> {
  const covered = new Set<MealSlot>();
  for (const name of names) {
    const slot = slotForLoggedName(name);
    if (slot) covered.add(slot);
  }
  return covered;
}

/** One suggested meal within the day's plan. */
export interface MealSlotPlan {
  slot: MealSlot;
  /** 1-based position in the day (1 = first suggested meal). */
  order: number;
  /** Serbian label for the slot ("Doručak" / "Glavni obrok"). */
  labelSr: string;
  /** kcal this meal is sized to. */
  targetKcal: number;
  /** Protein (g) this meal is meant to deliver. */
  targetProteinG: number;
  /** True once the day's consumed protein has reached this meal's cumulative
   * protein target -- the meal is considered covered. */
  done: boolean;
  /** Ranked healthy suggestions (empty when `done`). `[0]` is shown; the rest
   * are the swap cycle. */
  suggestions: ScaledMeal[];
}

export interface MealPlan {
  /** 1 or 2 suggested meals for the day. */
  suggestedCount: number;
  /** How many of the suggested meals are already covered (0..suggestedCount). */
  mealsDone: number;
  /** Whole grams of protein logged today. */
  proteinConsumedG: number;
  /** The day's protein target (whole grams). */
  proteinTargetG: number;
  /** kcal left for the free third meal after reserving uncovered suggestions. */
  freeRoomKcal: number;
  /** The suggested meals, in day order. */
  slots: MealSlotPlan[];
}

/**
 * kcal + protein SHARES of the day each suggested meal aims for, by how many
 * meals are suggested. Two-meal days front-load ~80% of protein into the two
 * suggestions and reserve ~65% of kcal, leaving a generous ~35% for the free
 * meal. One-meal days (small protein targets) reserve less.
 *
 * Shares are of the DAILY target, not of each other; they intentionally sum to
 * less than 1 so the free meal always has room.
 */
interface SlotShare {
  slot: MealSlot;
  labelSr: string;
  kcalShare: number;
  proteinShare: number;
}

const TWO_MEAL_SHARES: SlotShare[] = [
  { slot: "dorucak", labelSr: "Doručak", kcalShare: 0.28, proteinShare: 0.35 },
  { slot: "glavni", labelSr: "Glavni obrok", kcalShare: 0.37, proteinShare: 0.45 },
];

const ONE_MEAL_SHARES: SlotShare[] = [
  { slot: "glavni", labelSr: "Glavni obrok", kcalShare: 0.45, proteinShare: 0.55 },
];

/**
 * Protein target (g) at/above which the day gets TWO suggested meals. Below it,
 * a single solid meal can realistically carry the whole protein floor, so we
 * suggest one and leave the rest of the day free.
 */
export const TWO_MEAL_PROTEIN_THRESHOLD_G = 100;

function roundKcal(value: number): number {
  return Math.round(value);
}

/** The slot shares for a given protein target (decides 1 vs 2 meals). */
function sharesFor(proteinTargetG: number): SlotShare[] {
  return proteinTargetG >= TWO_MEAL_PROTEIN_THRESHOLD_G
    ? TWO_MEAL_SHARES
    : ONE_MEAL_SHARES;
}

/**
 * Lightweight progress the /danas reminder needs, WITHOUT ranking any
 * suggestions (kept cheap for the home screen): how many meals are suggested,
 * how many are already covered, and the free-room kcal.
 */
export function planProgress(input: {
  target: PlanTarget;
  consumed: MacroVector;
  loggedMealNames?: string[];
}): {
  suggestedCount: number;
  mealsDone: number;
  freeRoomKcal: number;
  proteinConsumedG: number;
  proteinTargetG: number;
} {
  const dailyKcal = Math.max(0, roundKcal(input.target.dailyKcal));
  const proteinTargetG = Math.max(0, Math.round(input.target.proteinG));
  const consumedKcal = Math.max(0, input.consumed.kcal);
  const consumedProteinG = Math.max(0, input.consumed.proteinG);

  const shares = sharesFor(proteinTargetG);
  const covered = coveredSlotsFrom(input.loggedMealNames ?? []);

  // A meal is done when its suggestion was logged (name match) OR the day's
  // consumed protein has reached its cumulative protein target (covers protein
  // hit via the user's own foods). Cumulative thresholds are monotonic.
  let cumulativeProtein = 0;
  let mealsDone = 0;
  let reservedKcalForUncovered = 0;

  for (const share of shares) {
    cumulativeProtein += share.proteinShare * proteinTargetG;
    const done =
      covered.has(share.slot) || consumedProteinG >= cumulativeProtein;
    if (done) {
      mealsDone += 1;
    } else {
      reservedKcalForUncovered += share.kcalShare * dailyKcal;
    }
  }

  const freeRoomKcal = Math.max(
    0,
    roundKcal(dailyKcal - consumedKcal - reservedKcalForUncovered)
  );

  return {
    suggestedCount: shares.length,
    mealsDone,
    freeRoomKcal,
    proteinConsumedG: Math.round(consumedProteinG),
    proteinTargetG,
  };
}

/**
 * The full plan for the detail screen: progress plus a ranked list of curated
 * healthy suggestions for every meal that is not yet covered.
 */
export function computeMealPlan(input: MealPlanInput): MealPlan {
  const dailyKcal = Math.max(0, roundKcal(input.target.dailyKcal));
  const proteinTargetG = Math.max(0, Math.round(input.target.proteinG));
  const consumedProteinG = Math.max(0, input.consumed.proteinG);
  const shares = sharesFor(proteinTargetG);
  const limit = input.suggestionsPerSlot ?? 4;
  const covered = coveredSlotsFrom(input.loggedMealNames ?? []);

  let cumulativeProtein = 0;
  const usedTemplateIds: string[] = [];
  const slots: MealSlotPlan[] = shares.map((share, index) => {
    cumulativeProtein += share.proteinShare * proteinTargetG;
    const done =
      covered.has(share.slot) || consumedProteinG >= cumulativeProtein;

    const targetKcal = roundKcal(share.kcalShare * dailyKcal);
    const targetProteinG = Math.round(share.proteinShare * proteinTargetG);

    let suggestions: ScaledMeal[] = [];
    if (!done) {
      suggestions = rankSuggestionsForSlot(
        share.slot,
        { kcal: targetKcal, proteinG: targetProteinG },
        { excludeIds: usedTemplateIds, avoidTags: input.avoidTags, limit }
      );
      // Keep the shown pick from being repeated by a later slot of the same
      // kind (only matters if two slots ever share a slot type).
      if (suggestions[0]) usedTemplateIds.push(suggestions[0].templateId);
    }

    return {
      slot: share.slot,
      order: index + 1,
      labelSr: share.labelSr,
      targetKcal,
      targetProteinG,
      done,
      suggestions,
    };
  });

  const progress = planProgress({
    target: input.target,
    consumed: input.consumed,
    loggedMealNames: input.loggedMealNames,
  });

  return {
    suggestedCount: shares.length,
    mealsDone: progress.mealsDone,
    proteinConsumedG: progress.proteinConsumedG,
    proteinTargetG,
    freeRoomKcal: progress.freeRoomKcal,
    slots,
  };
}
