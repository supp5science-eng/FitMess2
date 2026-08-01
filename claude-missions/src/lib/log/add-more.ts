import { z } from "zod";

import {
  aiExtraFoodSchema,
  extraComponent,
  type ExtraFood,
} from "@/lib/log/extras";
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
//   3. (2026-08-01) You photographed the plate and THEN reached for the
//      mayonnaise. Nothing on the row describes mayonnaise, so neither of the
//      above can express it: the entry has to grow by a food that was never
//      part of it. Those come from the catalog (`src/lib/log/extras.ts`), so
//      the numbers are verified rather than guessed.
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
  /**
   * Foods that were never in the entry ("nije bilo na slici"), as ids plus a
   * tap count. Deliberately ONLY an id for catalog picks: the server resolves
   * the numbers from `foods` itself, so a tampered or stale client cannot
   * author a macro.
   *
   * Written-in extras appear here too, under their `ai:` id -- what they are
   * made of travels separately, in `ai_dodaci` below.
   */
  extras: z
    .array(z.object({ foodId: z.string().min(1), units: unitsSchema }))
    .max(12)
    .default([]),
  /**
   * The definitions behind any `ai:` picks above -- foods the user described in
   * their own words, estimated by `POST /api/dodaci/opis`. They have no catalog
   * row to re-read, so they carry their own per-100 g numbers (clamped by
   * `aiExtraFoodSchema` to what a real food can be).
   */
  ai_dodaci: z.array(aiExtraFoodSchema).max(6).default([]),
});

export type AddMoreSelection = z.infer<typeof addMoreSelectionSchema>;

/**
 * What `applyAddMore` accepts: the same shape with every field optional.
 *
 * The schema fills these in for anything that came over the wire, but the
 * preview builds a selection by hand and a missing `extras` should mean "no
 * extras", not a type error -- the function treats an absent field and an empty
 * one identically.
 */
export interface AddMoreSelectionInput {
  whole?: number;
  components?: { index: number; units: number }[];
  extras?: { foodId: string; units: number }[];
}

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
  Partial<
    Pick<Log, "fiber" | "sugar" | "sodium" | "sat_fat" | "components" | "name">
  >;

/** Stands in for the entry's own name when it has to become a breakdown line
 * and the caller passed no `name` (older callers, hand-built test fixtures). */
const UNNAMED_ENTRY_SR = "Obrok";

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
  selection: AddMoreSelectionInput,
  /**
   * Catalog rows for the `extras` picks, resolved by the caller: the sheet
   * passes what it fetched for the chips, the route passes what it just re-read
   * from `foods`. A pick with no matching row here is silently skipped, which
   * is what should happen when a food was removed while the sheet was open.
   */
  extraFoods: readonly ExtraFood[] = []
): AddMoreResult {
  const baseComponents = readComponents(log.components);

  const whole = Math.min(
    Math.max(Math.trunc(selection.whole ?? 0) || 0, 0),
    MAX_UNITS
  );

  // Collapse the picks into "extra units per component index", ignoring picks
  // that point past the stored breakdown (a stale sheet after an edit).
  const extraUnits = new Map<number, number>();
  for (const pick of selection.components ?? []) {
    if (pick.index < 0 || pick.index >= baseComponents.length) continue;
    const units = Math.min(Math.max(Math.trunc(pick.units) || 0, 0), MAX_UNITS);
    if (units === 0) continue;
    extraUnits.set(
      pick.index,
      Math.min((extraUnits.get(pick.index) ?? 0) + units, MAX_UNITS)
    );
  }

  // Extras, collapsed per food id and resolved against the catalog rows the
  // caller supplied. Built before the arithmetic so `isEmpty` and the
  // synthesised breakdown below can both see whether any survived.
  const extraLines: LogComponentSnapshot[] = [];
  const extraMicros: ExtraFood[] = [];
  const extraGramsById = new Map<string, number>();
  {
    const byId = new Map(extraFoods.map((food) => [food.id, food]));
    const picked = new Map<string, number>();
    for (const pick of selection.extras ?? []) {
      const units = Math.min(Math.max(Math.trunc(pick.units) || 0, 0), MAX_UNITS);
      if (units === 0 || !byId.has(pick.foodId)) continue;
      picked.set(
        pick.foodId,
        Math.min((picked.get(pick.foodId) ?? 0) + units, MAX_UNITS)
      );
    }
    for (const [foodId, units] of picked) {
      const food = byId.get(foodId)!;
      extraLines.push(extraComponent(food, units));
      extraMicros.push(food);
      extraGramsById.set(foodId, food.unit_grams * units);
    }
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
  // Micronutrients ride the SAME-FOOD additions only. Extras are a different
  // food with their own per-100 g values, so folding their mass into this ratio
  // would scale the meal's fiber by a spoon of mayonnaise -- they are added
  // separately, below, from their own catalog numbers.
  //
  // Falls back to the whole-entry count when the row has no usable grams
  // (never divide by zero).
  const microScale = baseGrams > 0 ? addedGrams / baseGrams : whole;
  const growMicro = (
    value: number | null | undefined,
    fromExtras: (food: ExtraFood) => number | null
  ) => {
    // Unknown stays unknown (0017): a meal whose fiber we never knew does not
    // become "0.2 g of fiber" because mayonnaise was added to it.
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    let total = value * (1 + microScale);
    for (const food of extraMicros) {
      const per100 = fromExtras(food);
      if (per100 === null) continue;
      total += per100 * ((extraGramsById.get(food.id) ?? 0) / 100);
    }
    return round1(total);
  };

  for (const line of extraLines) {
    addedGrams += nonNegative(line.grami);
    addedKcal += nonNegative(line.kcal);
    addedProtein += nonNegative(line.protein_g);
    addedCarbs += nonNegative(line.uh_g);
    addedFat += nonNegative(line.mast_g);
  }

  const grownComponents =
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
      fiber: growMicro(log.fiber, (food) => food.fiber_100g),
      sugar: growMicro(log.sugar, (food) => food.sugar_100g),
      sodium: growMicro(log.sodium, (food) => food.sodium_100g),
      satFat: growMicro(log.sat_fat, (food) => food.sat_fat_100g),
    },
    components: mergeExtraLines(grownComponents, extraLines, {
      name: log.name,
      grams: round1(baseGrams * (1 + whole)),
      kcal: Math.round(nonNegative(log.kcal) * (1 + whole)),
      protein: round1(nonNegative(log.protein) * (1 + whole)),
      carbs: round1(nonNegative(log.carbs) * (1 + whole)),
      fat: round1(nonNegative(log.fat) * (1 + whole)),
    }),
    addedKcal: Math.round(addedKcal),
    isEmpty: whole === 0 && extraUnits.size === 0 && extraLines.length === 0,
  };
}

/** Case/whitespace-insensitive line identity, so a second visit that adds
 * another spoon of "Majonez" grows the line the first visit created instead of
 * stacking a duplicate under it. */
const lineKey = (naziv: string) => naziv.trim().toLocaleLowerCase("sr-Latn");

/**
 * Folds the extras into the breakdown.
 *
 * The interesting case is an entry with NO breakdown (a catalog log, a Gric
 * snack, or a meal whose split failed) that just gained mayonnaise. Writing
 * `[mayonnaise]` alone would claim the entry IS mayonnaise, so the entry's own
 * totals become the first line and the extra sits beside it — a breakdown that
 * still adds up to the row. Without extras this returns the grown breakdown
 * untouched, so nothing changes for entries that never use the feature.
 */
function mergeExtraLines(
  grown: LogComponentSnapshot[] | null,
  extraLines: readonly LogComponentSnapshot[],
  entryAsLine: {
    name: string | undefined;
    grams: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): LogComponentSnapshot[] | null {
  if (extraLines.length === 0) return grown;

  const merged: LogComponentSnapshot[] = grown
    ? [...grown]
    : [
        {
          naziv: (entryAsLine.name ?? "").trim() || UNNAMED_ENTRY_SR,
          grami: entryAsLine.grams,
          kcal: entryAsLine.kcal,
          protein_g: entryAsLine.protein,
          uh_g: entryAsLine.carbs,
          mast_g: entryAsLine.fat,
          // No natural unit: one step of this line is the whole thing again,
          // which is exactly what "Ceo obrok još jednom" already meant.
          kom_naziv: "",
          kom_grami: 0,
        },
      ];

  for (const line of extraLines) {
    const at = merged.findIndex(
      (existing) => lineKey(existing.naziv) === lineKey(line.naziv)
    );
    if (at === -1) {
      merged.push(line);
      continue;
    }
    const existing = merged[at];
    merged[at] = {
      ...existing,
      grami: round1(nonNegative(existing.grami) + line.grami),
      kcal: Math.round(nonNegative(existing.kcal) + line.kcal),
      protein_g: round1(nonNegative(existing.protein_g) + line.protein_g),
      uh_g: round1(nonNegative(existing.uh_g) + line.uh_g),
      mast_g: round1(nonNegative(existing.mast_g) + line.mast_g),
      // Keep whichever natural unit is already known: the line must stay
      // steppable at the same granularity it had before.
      kom_naziv: (existing.kom_naziv ?? "").trim() || line.kom_naziv || "",
      kom_grami: nonNegative(existing.kom_grami ?? 0) || line.kom_grami || 0,
    };
  }

  return merged;
}
