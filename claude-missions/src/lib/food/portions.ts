import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, FoodCommonUnit, Log, LogMethod } from "@/lib/types/db";

// F025 / AS-041, AS-042: the shared "portion -> log row" core.
//
// Split the same way F023's `src/lib/food/search.ts` and F024's
// `src/lib/food/recents.ts` split deterministic helpers from Supabase I/O
// (per the clarified "deterministic helpers factored into src/lib/"
// pattern): `computeMacrosForGrams` and `resolveUnitGrams` are pure, DB-free
// functions unit-tested with plain fixtures; `createLogFromPortion` is the
// thin I/O wrapper `POST /api/logs` (this feature) calls, and the one
// `src/components/food/portion-picker.tsx`'s grams/common-unit picker
// resolves a portion down to before ever reaching this file -- units and
// quantity multipliers are a UI-layer concern only, this module and the API
// route only ever deal with a final `grams` number, kept deliberately
// simple so it is trivially reusable.
//
// REUSE NOTE for later features: F031 (barcode scan) and F062/F064 (photo
// label/meal-estimate logging) should call `createLogFromPortion` directly
// (or `POST /api/logs` with their own `method` value -- 'barcode'/'label')
// rather than re-implementing "look up per-100g values, multiply by
// grams/100, snapshot into `logs`" -- that is exactly what this function
// does, framework- and UI-free.

/** Single-entry gram bounds -- generous enough for a big pot of soup or a
 * whole meal logged as one entry, small enough to catch a fat-fingered
 * "10000g" input before it ever reaches the database. */
export const MIN_PORTION_GRAMS = 1;
export const MAX_PORTION_GRAMS = 5000;

export const GRAMS_TOO_SMALL_ERROR_SR = "Unesi količinu veću od 0 grama.";
export const GRAMS_TOO_LARGE_ERROR_SR =
  "Uneta količina je prevelika. Najviše 5000 grama po unosu.";
export const LOG_CREATE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.";

/** The minimal shape this module needs from a `foods` row -- callers can
 * pass the full Supabase row shape or a hand-built test fixture, exactly
 * like `src/lib/food/recents.ts`'s `RecentLogRow` does for `logs`. */
export interface PortionFoodInput {
  id: string;
  name_sr: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

/** zod schema for a raw, already-resolved portion size in grams (the UI has
 * already turned "2 parčeta" into a gram number by the time this is
 * validated -- see the header comment). */
export const gramsSchema = z
  .number({ message: GRAMS_TOO_SMALL_ERROR_SR })
  .finite({ message: GRAMS_TOO_SMALL_ERROR_SR })
  .min(MIN_PORTION_GRAMS, GRAMS_TOO_SMALL_ERROR_SR)
  .max(MAX_PORTION_GRAMS, GRAMS_TOO_LARGE_ERROR_SR);

/** Rounds to one decimal place -- matches `logs`' `numeric(7,1)` columns
 * (grams, kcal, protein, carbs, fat) so what the UI previews is exactly
 * what gets persisted, never silently truncated/re-rounded by Postgres. */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface PortionMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * AS-041: computes kcal + macros for a given gram amount from a food's
 * per-100g values -- `value_100g * (grams / 100)`, rounded to one decimal.
 * Pure and framework-free; this is the ONLY place in the app that performs
 * this multiplication, per the "money-math rule" (tech-decisions.md):
 * deterministic code computes numbers, nothing else guesses at them.
 */
export function computeMacrosForGrams(
  food: PortionFoodInput,
  grams: number
): PortionMacros {
  const multiplier = grams / 100;
  return {
    kcal: roundToOneDecimal(food.kcal_100g * multiplier),
    protein: roundToOneDecimal(food.protein_100g * multiplier),
    carbs: roundToOneDecimal(food.carbs_100g * multiplier),
    fat: roundToOneDecimal(food.fat_100g * multiplier),
  };
}

/**
 * AS-042: resolves a common-unit selection (e.g. `{label:"parče",
 * grams:50}`) plus a quantity multiplier (e.g. `2` for "2 parčeta") down to
 * a final gram amount -- `unit.grams * quantity`, rounded to one decimal.
 * Pure; the caller (the portion-picker UI) is responsible for then feeding
 * the result into `computeMacrosForGrams`/the create-log call exactly like
 * a raw grams entry would be.
 */
export function resolveUnitGrams(
  unit: FoodCommonUnit,
  quantity: number
): number {
  return roundToOneDecimal(unit.grams * quantity);
}

export type CreateLogResult =
  | { ok: true; data: Log }
  | { ok: false; error_sr: string; status: 400 | 500 };

/**
 * Validates `grams`, computes the kcal/macro snapshot from `food`'s
 * per-100g values (AS-041), and inserts a single `logs` row -- name +
 * computed macros are SNAPSHOTTED onto the row (never a live join back to
 * `foods`), per `supabase/migrations/0004_foods_logs.sql`'s documented
 * convention, so a later edit to (or deletion of) the referenced food never
 * changes this historical entry.
 *
 * `supabase` must be the CALLER's session-bound (RLS) client, never the
 * admin client -- `logs_insert_own` RLS is what actually enforces "a user
 * can only ever create their OWN log rows" (own-user scope, per the
 * clarified access-control answer), not application code re-implementing
 * that check. A single `insert().select().single()` call is the entire
 * write -- there is nothing to partially fail (no multi-statement
 * transaction needed): either this one row is created, or nothing is.
 */
export async function createLogFromPortion(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    food: PortionFoodInput;
    grams: number;
    method: LogMethod;
  }
): Promise<CreateLogResult> {
  const parsedGrams = gramsSchema.safeParse(params.grams);
  if (!parsedGrams.success) {
    const errorSr =
      parsedGrams.error.issues[0]?.message ?? GRAMS_TOO_SMALL_ERROR_SR;
    return { ok: false, error_sr: errorSr, status: 400 };
  }
  const grams = roundToOneDecimal(parsedGrams.data);
  const macros = computeMacrosForGrams(params.food, grams);

  const { data, error } = await supabase
    .from("logs")
    .insert({
      user_id: params.userId,
      food_id: params.food.id,
      name: params.food.name_sr,
      grams,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      method: params.method,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error_sr: LOG_CREATE_FAILED_ERROR_SR, status: 500 };
  }

  return { ok: true, data };
}
