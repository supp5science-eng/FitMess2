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
//
// F026 / AS-044, AS-045 added `updateLogFromPortion` (edit) and `deleteLog`
// (delete) below, same split: pure `findMatchingCommonUnit` helper +
// session-client I/O wrappers that `PATCH`/`DELETE /api/logs/[id]`
// (`src/app/api/logs/[id]/route.ts`) call. F027 (home/today) should wire
// `src/components/food/log-edit-sheet.tsx` (`LogEditSheet`) and
// `src/components/food/log-delete-confirm.tsx` (`LogDeleteConfirm`) onto its
// meal cards rather than re-implementing the edit/delete UI -- both are
// self-contained (own trigger button + open state) and accept an `onSaved`/
// `onDeleted` callback so the caller can re-fetch/recompute the day's
// remaining budget after a change.

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

// F026 / AS-044 (edit recalculates), AS-045 (delete): shared error copy for
// the edit/delete endpoints + components below -- same "own-row via RLS,
// never leak whether a row exists for another user" posture as every other
// mutation in this codebase (see `updateLogFromPortion`/route.ts).
export const LOG_NOT_FOUND_ERROR_SR =
  "Unos nije pronađen ili nemaš pristup njemu.";
export const LOG_FOOD_UNAVAILABLE_ERROR_SR =
  "Namirnica za ovaj unos više nije dostupna, pa količinu ne možeš da izmeniš.";
export const LOG_UPDATE_FAILED_ERROR_SR =
  "Nismo uspeli da izmenimo unos. Pokušaj ponovo.";
export const LOG_DELETE_FAILED_ERROR_SR =
  "Nismo uspeli da obrišemo unos. Pokušaj ponovo.";

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

/**
 * F026: given a food's `common_units` and an already-resolved gram amount
 * (e.g. an existing log's `grams`), finds the unit + quantity that would
 * have produced exactly that gram amount, if any -- so the edit sheet can
 * pre-select "2 parčeta" instead of always falling back to a raw grams
 * entry when re-opening an entry that was originally logged via a common
 * unit. Pure; tries quantities in 0.5 steps up to `MAX_UNIT_MATCH_QUANTITY`
 * (matches the picker's own `MAX_QUANTITY` UI bound) and returns the FIRST
 * unit (in array order) that matches within a small floating-point epsilon
 * -- there is no other signal (the persisted row only ever stores the final
 * grams number, per the clarified "server/shared-lib only ever deals with
 * one gram number" design) to prefer one unit over another when several
 * would technically produce the same total.
 */
const MAX_UNIT_MATCH_QUANTITY = 20;
const UNIT_MATCH_EPSILON = 0.01;

export interface CommonUnitMatch {
  unitIndex: number;
  quantity: number;
}

export function findMatchingCommonUnit(
  units: FoodCommonUnit[],
  grams: number
): CommonUnitMatch | null {
  for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
    const unit = units[unitIndex];
    if (!unit || unit.grams <= 0) continue;
    const rawQuantity = grams / unit.grams;
    const roundedQuantity = Math.round(rawQuantity * 2) / 2; // nearest 0.5
    if (roundedQuantity < 0.5 || roundedQuantity > MAX_UNIT_MATCH_QUANTITY) {
      continue;
    }
    const producedGrams = roundToOneDecimal(unit.grams * roundedQuantity);
    if (Math.abs(producedGrams - grams) <= UNIT_MATCH_EPSILON) {
      return { unitIndex, quantity: roundedQuantity };
    }
  }
  return null;
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

export type UpdateLogResult =
  | { ok: true; data: Log }
  | { ok: false; error_sr: string; status: 400 | 404 | 500 };

/**
 * F026 / AS-044: edits an EXISTING log entry's portion -- validates the new
 * `grams` (same bounds as create), recomputes kcal/macros from `food`'s
 * CURRENT/live per-100g values (never the log row's stale snapshot, exactly
 * like `createLogFromPortion` never trusts a client-submitted number), and
 * updates the snapshot columns in place. `name`/`food_id` are left
 * untouched -- only the portion (and the numbers derived from it) changes.
 *
 * `supabase` MUST be the CALLER's session-bound (RLS) client. `logs_
 * update_own` RLS (`supabase/migrations/0004_foods_logs.sql`) is what
 * actually enforces "a user can only ever edit their OWN log rows" -- if
 * `logId` belongs to another user (or does not exist at all), RLS silently
 * matches zero rows and this returns the same 404 either way (this route
 * never reveals whether a given id exists for someone else, matching the
 * "denied" cross-user posture the clarified access-control answer calls
 * for).
 */
export async function updateLogFromPortion(
  supabase: SupabaseClient<Database>,
  params: {
    logId: string;
    food: PortionFoodInput;
    grams: number;
  }
): Promise<UpdateLogResult> {
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
    .update({
      grams,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    })
    .eq("id", params.logId)
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error_sr: LOG_UPDATE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    // RLS filtered the row out (not owned) or it never existed.
    return { ok: false, error_sr: LOG_NOT_FOUND_ERROR_SR, status: 404 };
  }

  return { ok: true, data };
}

export type DeleteLogResult =
  | { ok: true }
  | { ok: false; error_sr: string; status: 404 | 500 };

/**
 * F026 / AS-045: deletes an EXISTING log entry. `supabase` MUST be the
 * CALLER's session-bound (RLS) client -- `logs_delete_own` RLS is what
 * actually enforces "own row only," not this function re-implementing that
 * check. `.select("id")` on the delete is required to actually learn
 * whether any row was affected: an unfiltered/RLS-filtered delete against a
 * nonexistent or not-owned id returns `{ error: null, data: [] }` (Postgrest
 * default), NOT an error, so without selecting back the affected row(s) a
 * cross-user delete attempt would silently "succeed" with zero effect
 * instead of being reported as not-found/denied.
 */
export async function deleteLog(
  supabase: SupabaseClient<Database>,
  logId: string
): Promise<DeleteLogResult> {
  const { data, error } = await supabase
    .from("logs")
    .delete()
    .eq("id", logId)
    .select("id");

  if (error) {
    return { ok: false, error_sr: LOG_DELETE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data || data.length === 0) {
    return { ok: false, error_sr: LOG_NOT_FOUND_ERROR_SR, status: 404 };
  }

  return { ok: true };
}
