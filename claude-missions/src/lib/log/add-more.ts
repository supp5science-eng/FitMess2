import { z } from "zod";

import type { Log, LogComponentSnapshot } from "@/lib/types/db";

// "Dodaj još" (2026-07-25): seconds without a second photo.
//
// Two shapes of the same problem:
//   1. You logged ONE wafer, then ate another. Nothing about the entry changes
//      except that there were two of them -- pure arithmetic on the row.
//   2. You photographed eggs + tuna + sour cream as ONE meal, then went back
//      for two more eggs and a spoon of cream. Here the entry has to grow
//      UNEVENLY, which is only possible because 0019 keeps the AI's itemised
//      breakdown on the row (`logs.components`).
//
// Everything in this file is pure so the sheet's live preview and the server's
// authoritative recompute run the SAME math -- the same guarantee F025/F026
// established for portions (`src/lib/food/portions.ts`). The server never
// trusts a client-sent macro number; it re-reads the row and calls this.

/** How many extra units a single tap adds, and the ceiling per sheet visit. */
export const MAX_UNITS = 20;

const unitsSchema = z.coerce.number().int().min(0).max(MAX_UNITS);

/**
 * What the user tapped: extra copies of the whole entry, plus extra units of
 * individual components (keyed by their index in `logs.components`).
 *
 * `whole: 1` with no component picks is the wafer case -- and the default the
 * sheet opens on, so the common path is "open, confirm".
 */
export const addMoreSelectionSchema = z.object({
  whole: unitsSchema.default(0),
  components: z
    .array(z.object({ index: z.coerce.number().int().min(0), units: unitsSchema }))
    .max(12)
    .default([]),
});

export type AddMoreSelection = z.infer<typeof addMoreSelectionSchema>;

/** The nutrition fields "Dodaj još" grows. Micros stay nullable: unknown at
 * one portion is still unknown at two (never silently 0 -- see 0017). */
export interface LogNutrition {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  satFat: number | null;
}

export interface AddMoreResult {
  /** The entry's new totals, ready to write. */
  totals: LogNutrition;
  /** The breakdown, rescaled by each component's multiplier. `null` when the
   * entry had none (nothing to rescale). */
  components: LogComponentSnapshot[] | null;
  /** kcal added by this selection -- what the sheet shows as "+310 kcal". */
  addedKcal: number;
  /** True when the selection adds nothing (nothing to save). */
  isEmpty: boolean;
}

/** The subset of a log row this math reads. */
export type AddMoreLogInput = Pick<
  Log,
  "grams" | "kcal" | "protein" | "carbs" | "fat"
> &
  Partial<Pick<Log, "fiber" | "sugar" | "sodium" | "sat_fat" | "components">>;

const round1 = (n: number) => Math.round(n * 10) / 10;
const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Reads a stored breakdown defensively -- jsonb from the database is `unknown`
 * as far as correctness goes, and a malformed row must degrade to "no
 * breakdown" (whole-entry seconds still work) rather than break the card. */
export function readComponents(
  raw: LogComponentSnapshot[] | null | undefined
): LogComponentSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (component): component is LogComponentSnapshot =>
      !!component &&
      typeof component === "object" &&
      typeof component.naziv === "string" &&
      Number.isFinite(component.grami) &&
      Number.isFinite(component.kcal)
  );
}

/**
 * What fraction of a breakdown line ONE step adds.
 *
 * A line reads "jaja, 120 g" -- the plate held two. Stepping "+1" must add ONE
 * egg, not another two, so when the estimator gave a natural unit mass
 * (`kom_grami`, e.g. 60 g) a step adds that fraction of the line. Lines with no
 * natural unit (sauce, oil) fall back to 1: one step = the whole line again,
 * which is the only meaning available there.
 *
 * Clamped to at most 1 -- a unit heavier than the line itself is a bad estimate,
 * and "+1" should never add more than a second helping of that part.
 */
export function componentUnitFraction(component: LogComponentSnapshot): number {
  const total = nonNegative(component.grami);
  const unit = nonNegative(component.kom_grami ?? 0);
  if (total <= 0 || unit <= 0) return 1;
  return Math.min(unit / total, 1);
}

/**
 * How many natural units this line currently holds -- "6" for 300 g of eggs at
 * 50 g each. `null` when the line has no natural unit, and therefore nothing
 * countable to show.
 *
 * Display only: it tells the user WHAT IS ALREADY IN the meal ("6 × jaje"), so
 * the stepper beside it is unambiguously "how many MORE".
 */
export function componentPieceCount(
  component: LogComponentSnapshot
): number | null {
  const total = nonNegative(component.grami);
  const unit = nonNegative(component.kom_grami ?? 0);
  if (total <= 0 || unit <= 0) return null;
  const count = Math.round(total / unit);
  return count > 0 ? count : null;
}

/** Human label for one step of a line: "1 jaje (60 g)" / "još jednom (120 g)". */
export function componentUnitLabel(component: LogComponentSnapshot): string {
  const unitName = (component.kom_naziv ?? "").trim();
  const unit = nonNegative(component.kom_grami ?? 0);
  if (unitName && unit > 0) return `1 ${unitName} · ${Math.round(unit)} g`;
  return `cela stavka · ${Math.round(nonNegative(component.grami))} g`;
}

/**
 * Applies a "Dodaj još" selection to an entry and returns its new totals.
 *
 * Whole-entry units multiply the row; component units add that component's own
 * values. Micronutrients ride along on the GRAMS ratio rather than being summed
 * per component -- the AI breakdown carries macros only, and a proportional
 * split is both the honest reading of "more of the same food" and exact in the
 * whole-entry case (where the added grams are exactly N× the base).
 *
 * Multipliers are always applied to the entry as it is NOW, and the sheet sends
 * one selection per save, so repeated visits compound cleanly (×2 then ×2 = ×4
 * of the original) with no drift from re-deriving a base.
 */
export function applyAddMore(
  log: AddMoreLogInput,
  selection: AddMoreSelection
): AddMoreResult {
  const baseComponents = readComponents(log.components);

  const whole = Math.min(Math.max(Math.trunc(selection.whole) || 0, 0), MAX_UNITS);

  // Collapse the picks into "extra units per component index", ignoring picks
  // that point past the stored breakdown (a stale sheet after an edit).
  const extraUnits = new Map<number, number>();
  for (const pick of selection.components) {
    if (pick.index < 0 || pick.index >= baseComponents.length) continue;
    const units = Math.min(Math.max(Math.trunc(pick.units) || 0, 0), MAX_UNITS);
    if (units === 0) continue;
    extraUnits.set(
      pick.index,
      Math.min((extraUnits.get(pick.index) ?? 0) + units, MAX_UNITS)
    );
  }

  let addedGrams = nonNegative(log.grams) * whole;
  let addedKcal = nonNegative(log.kcal) * whole;
  let addedProtein = nonNegative(log.protein) * whole;
  let addedCarbs = nonNegative(log.carbs) * whole;
  let addedFat = nonNegative(log.fat) * whole;

  for (const [index, units] of extraUnits) {
    const component = baseComponents[index];
    // One step = one natural unit of that part (one egg, one spoon), not the
    // whole line -- see `componentUnitFraction`.
    const share = componentUnitFraction(component) * units;
    addedGrams += nonNegative(component.grami) * share;
    addedKcal += nonNegative(component.kcal) * share;
    addedProtein += nonNegative(component.protein_g) * share;
    addedCarbs += nonNegative(component.uh_g) * share;
    addedFat += nonNegative(component.mast_g) * share;
  }

  const baseGrams = nonNegative(log.grams);
  // Ratio of added mass to the entry's current mass. Falls back to the
  // whole-entry count when the row has no usable grams (never divide by zero).
  const microScale = baseGrams > 0 ? addedGrams / baseGrams : whole;
  const growMicro = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? round1(value * (1 + microScale))
      : null;

  const components =
    baseComponents.length > 0
      ? baseComponents.map((component, index) => {
          const multiplier =
            1 +
            whole +
            componentUnitFraction(component) * (extraUnits.get(index) ?? 0);
          return {
            naziv: component.naziv,
            grami: round1(nonNegative(component.grami) * multiplier),
            kcal: Math.round(nonNegative(component.kcal) * multiplier),
            protein_g: round1(nonNegative(component.protein_g) * multiplier),
            uh_g: round1(nonNegative(component.uh_g) * multiplier),
            mast_g: round1(nonNegative(component.mast_g) * multiplier),
            // The natural unit is a property of the FOOD, not of how much of it
            // is on the plate -- it must survive growing the line untouched, or
            // the next "+1 jaje" would add a different amount than this one did.
            kom_naziv: component.kom_naziv ?? "",
            kom_grami: nonNegative(component.kom_grami ?? 0),
          };
        })
      : null;

  return {
    totals: {
      grams: round1(baseGrams + addedGrams),
      kcal: Math.round(nonNegative(log.kcal) + addedKcal),
      protein: round1(nonNegative(log.protein) + addedProtein),
      carbs: round1(nonNegative(log.carbs) + addedCarbs),
      fat: round1(nonNegative(log.fat) + addedFat),
      fiber: growMicro(log.fiber),
      sugar: growMicro(log.sugar),
      sodium: growMicro(log.sodium),
      satFat: growMicro(log.sat_fat),
    },
    components,
    addedKcal: Math.round(addedKcal),
    isEmpty: whole === 0 && extraUnits.size === 0,
  };
}
