import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { FOOD_NOT_FOUND_ERROR_SR } from "@/lib/food/admin-review";
import {
  FOOD_CREATE_FAILED_ERROR_SR,
  FOOD_DUPLICATE_BARCODE_ERROR_SR,
  MALFORMED_FOOD_REQUEST_ERROR_SR,
  isUniqueBarcodeViolation,
  newFoodEntrySchema,
} from "@/lib/food/create";
import type { Database, Food } from "@/lib/types/db";

// F035 / AS-061 (an admin can edit a food's name, brand, and nutrition
// values), AS-064 (the admin food editor supports scanning a barcode to
// create or open the product with that GTIN) -- plus the two agreed
// additions: a search over the WHOLE catalog (not just the review queue) and
// a food-database stats summary.
//
// Every function here takes an already-constructed *service-role admin*
// client (`createAdminClient()`, src/lib/supabase/server.ts) and MUST only
// ever be called behind the F033 gate (`requireAdminApi()` in a Route
// Handler, `requireAdmin()` in a page). Exactly like `admin-review.ts`: there
// is no UPDATE/INSERT-verified RLS policy on `public.foods`, so the admin
// client is the only way these writes can succeed -- enforcement lives in the
// gate, never in the UI.

export const COMMON_UNIT_LABEL_MAX = 40;
export const MAX_COMMON_UNIT_GRAMS = 5000;
export const MAX_COMMON_UNITS = 20;
export const MAX_ADMIN_SEARCH_RESULTS = 30;

export const COMMON_UNIT_LABEL_REQUIRED_ERROR_SR = "Unesi naziv mere.";
export const COMMON_UNIT_LABEL_TOO_LONG_ERROR_SR = "Naziv mere je predugačak.";
export const COMMON_UNIT_GRAMS_INVALID_ERROR_SR =
  "Gramaža mere mora biti veća od 0.";
export const FOOD_UPDATE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo izmene. Pokušaj ponovo.";

/** One `foods.common_units` entry: a named portion (e.g. "1 kriška" = 30g)
 * that the log flow (`portion-picker`, F025/F026) offers so a user can log
 * "1 kriška" instead of guessing grams. Same `{label, grams}` shape as
 * `FoodCommonUnit` in db.ts. */
export const commonUnitSchema = z.object({
  label: z
    .string({ message: COMMON_UNIT_LABEL_REQUIRED_ERROR_SR })
    .trim()
    .min(1, COMMON_UNIT_LABEL_REQUIRED_ERROR_SR)
    .max(COMMON_UNIT_LABEL_MAX, COMMON_UNIT_LABEL_TOO_LONG_ERROR_SR),
  grams: z
    .number({ message: COMMON_UNIT_GRAMS_INVALID_ERROR_SR })
    .finite({ message: COMMON_UNIT_GRAMS_INVALID_ERROR_SR })
    .positive(COMMON_UNIT_GRAMS_INVALID_ERROR_SR)
    .max(MAX_COMMON_UNIT_GRAMS, COMMON_UNIT_GRAMS_INVALID_ERROR_SR),
});

/** The admin create/edit payload: reuses every name/brand/barcode/macro rule
 * from the crowd-sourced `newFoodEntrySchema` (F032) so admin-entered values
 * are validated identically, and adds the `common_units` editor's array. */
export const adminFoodInputSchema = newFoodEntrySchema.extend({
  common_units: z
    .array(commonUnitSchema)
    .max(MAX_COMMON_UNITS)
    .default([]),
});

export type AdminFoodInput = z.infer<typeof adminFoodInputSchema>;

export type AdminFoodWriteResult =
  | { ok: true; data: Food }
  | {
      ok: false;
      error_sr: string;
      status: 400 | 404 | 409 | 500;
      existingFoodId?: string;
    };

/** Shared duplicate-barcode handling: on a UNIQUE violation (23505) look up
 * the existing food's id (so the UI can offer "open it instead"), otherwise a
 * generic failure. Mirrors `createFoodEntry`'s handling in create.ts. */
async function resolveDuplicateBarcode(
  admin: SupabaseClient<Database>,
  barcode: string | undefined
): Promise<AdminFoodWriteResult> {
  let existingFoodId: string | undefined;
  if (barcode) {
    const { data: existing } = await admin
      .from("foods")
      .select("id")
      .eq("barcode", barcode)
      .maybeSingle();
    existingFoodId = existing?.id;
  }
  return {
    ok: false,
    error_sr: FOOD_DUPLICATE_BARCODE_ERROR_SR,
    status: 409,
    existingFoodId,
  };
}

/**
 * Creates a food the admin has entered by hand, marked `verified: true` and
 * `source: 'seed'` (this is the PRD Addendum-1 manual-seeding workflow:
 * verified branded Serbian products pre-populated by the admin). No
 * `submitted_by` -- it is not a crowd-sourced submission. AS-061/AS-064.
 */
export async function createVerifiedFood(
  admin: SupabaseClient<Database>,
  input: unknown
): Promise<AdminFoodWriteResult> {
  const parsed = adminFoodInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error_sr:
        parsed.error.issues[0]?.message ?? MALFORMED_FOOD_REQUEST_ERROR_SR,
      status: 400,
    };
  }

  const { name_sr, brand, barcode, common_units, ...macros } = parsed.data;

  const { data, error } = await admin
    .from("foods")
    .insert({
      name_sr,
      brand: brand ?? null,
      barcode: barcode ?? null,
      ...macros,
      common_units,
      source: "seed",
      verified: true,
      submitted_by: null,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueBarcodeViolation(error)) {
      return resolveDuplicateBarcode(admin, barcode);
    }
    return { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    return { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR, status: 500 };
  }
  return { ok: true, data };
}

/**
 * Updates a food's editable content (name, brand, barcode, per-100g macros,
 * common_units) -- AS-061. Deliberately does NOT touch `verified` or
 * `is_removed`: verification stays with `verifyFood` and removal/restore with
 * `removeFood`/`restoreFood` (admin-review.ts), so each mutation is a single,
 * auditable concern. A duplicate barcode is reported the same friendly way as
 * on create.
 */
export async function updateFood(
  admin: SupabaseClient<Database>,
  foodId: string,
  input: unknown
): Promise<AdminFoodWriteResult> {
  const parsed = adminFoodInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error_sr:
        parsed.error.issues[0]?.message ?? MALFORMED_FOOD_REQUEST_ERROR_SR,
      status: 400,
    };
  }

  const { name_sr, brand, barcode, common_units, ...macros } = parsed.data;

  const { data, error } = await admin
    .from("foods")
    .update({
      name_sr,
      brand: brand ?? null,
      barcode: barcode ?? null,
      ...macros,
      common_units,
    })
    .eq("id", foodId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isUniqueBarcodeViolation(error)) {
      return resolveDuplicateBarcode(admin, barcode);
    }
    return { ok: false, error_sr: FOOD_UPDATE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    return {
      ok: false,
      error_sr: FOOD_NOT_FOUND_ERROR_SR,
      status: 404,
    };
  }
  return { ok: true, data };
}

export interface AdminFoodSearchResult {
  data: Food[] | null;
  error: { message: string } | null;
}

/** PostgREST `.or()` takes a comma-separated filter string, so a raw query
 * containing `,` `%` `(` `)` `*` would corrupt it. Strip those to spaces --
 * an admin search box, not a query language. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,%()*]/g, " ").trim();
}

/**
 * Searches the WHOLE catalog by name, brand, or barcode -- unlike the review
 * queue (`listUnverifiedFoods`) or the public `search_foods` RPC, this
 * includes verified, unverified AND removed foods, so an admin can find and
 * fix (or restore) any product. Newest first, capped at
 * MAX_ADMIN_SEARCH_RESULTS. Returns an empty list (never an error) for a
 * blank query.
 */
export async function searchAllFoods(
  admin: SupabaseClient<Database>,
  rawQuery: string
): Promise<AdminFoodSearchResult> {
  const term = sanitizeSearchTerm(rawQuery).slice(0, 100);
  if (term.length === 0) {
    return { data: [], error: null };
  }

  const pattern = `%${term}%`;
  const { data, error } = await admin
    .from("foods")
    .select("*")
    .or(`name_sr.ilike.${pattern},brand.ilike.${pattern},barcode.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(MAX_ADMIN_SEARCH_RESULTS);

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data ?? [], error: null };
}

export interface FoodStats {
  /** Foods currently live (not removed). */
  total: number;
  verified: number;
  /** Unverified & not removed == the review queue depth. */
  unverified: number;
  removed: number;
  bySource: { seed: number; off: number; user: number };
}

/** Cheap `head:true` count query for a set of equality filters on `foods`. */
async function countFoods(
  admin: SupabaseClient<Database>,
  filters: {
    verified?: boolean;
    is_removed?: boolean;
    source?: "seed" | "off" | "user";
  }
): Promise<number> {
  let query = admin.from("foods").select("*", { count: "exact", head: true });
  if (filters.verified !== undefined) query = query.eq("verified", filters.verified);
  if (filters.is_removed !== undefined)
    query = query.eq("is_removed", filters.is_removed);
  if (filters.source !== undefined) query = query.eq("source", filters.source);
  const { count } = await query;
  return count ?? 0;
}

/**
 * Food-database summary for the admin dashboard: how many live foods, how many
 * verified vs still-in-the-queue, how many removed, and a provenance
 * breakdown. All counts are cheap head-only `count: 'exact'` queries.
 */
export async function getFoodStats(
  admin: SupabaseClient<Database>
): Promise<FoodStats> {
  const [total, verified, removed, seed, off, user] = await Promise.all([
    countFoods(admin, { is_removed: false }),
    countFoods(admin, { is_removed: false, verified: true }),
    countFoods(admin, { is_removed: true }),
    countFoods(admin, { is_removed: false, source: "seed" }),
    countFoods(admin, { is_removed: false, source: "off" }),
    countFoods(admin, { is_removed: false, source: "user" }),
  ]);

  return {
    total,
    verified,
    unverified: total - verified,
    removed,
    bySource: { seed, off, user },
  };
}
