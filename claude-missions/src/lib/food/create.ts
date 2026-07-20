import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { gtinSchema } from "@/lib/food/barcode";
import type { Database, Food } from "@/lib/types/db";

// F032 / AS-055 (unknown barcode offers a first-time entry form), AS-056
// (the saved product is immediately findable by every user, by BOTH
// barcode and name search, and marked verified=false/source='user'),
// AS-057 (a duplicate barcode is rejected, not crashed on): the
// deterministic validation schema + the `foods` INSERT I/O wrapper for
// `POST /api/foods` (see that route's header comment).
//
// Split the same way F023's `src/lib/food/search.ts` and F031's
// `src/lib/food/barcode.ts` split pure validation from Supabase I/O, per
// the clarified "deterministic helpers factored into src/lib/" pattern.
// Reuses `gtinSchema` from F031's `src/lib/food/barcode.ts` rather than
// re-defining barcode shape validation -- a user-submitted barcode (when
// present) must be shaped exactly like a scanned one.

export const FOOD_NAME_REQUIRED_ERROR_SR = "Unesi naziv namirnice.";
export const FOOD_NAME_TOO_LONG_ERROR_SR = "Naziv je predugačak.";
export const FOOD_BRAND_TOO_LONG_ERROR_SR = "Naziv brenda je predugačak.";
export const FOOD_KCAL_INVALID_ERROR_SR =
  "Unesi ispravnu vrednost za kalorije (0–900 na 100g).";
export const FOOD_PROTEIN_INVALID_ERROR_SR =
  "Unesi ispravnu vrednost za proteine (0–100 na 100g).";
export const FOOD_CARBS_INVALID_ERROR_SR =
  "Unesi ispravnu vrednost za ugljene hidrate (0–100 na 100g).";
export const FOOD_FAT_INVALID_ERROR_SR =
  "Unesi ispravnu vrednost za masti (0–100 na 100g).";
export const FOOD_PRICE_INVALID_ERROR_SR =
  "Unesi ispravnu cenu u dinarima (0 ili više).";
export const FOOD_CREATE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo proizvod. Pokušaj ponovo.";
export const FOOD_DUPLICATE_BARCODE_ERROR_SR =
  "Proizvod sa ovim barkodom već postoji u bazi.";
export const MALFORMED_FOOD_REQUEST_ERROR_SR = "Neispravan zahtev.";

/** Sane per-100g bounds -- generous enough for real foods (pure fat/oil
 * tops out around 900 kcal/100g; no macro can exceed 100g per 100g of
 * product) while still catching an obviously fat-fingered entry, per the
 * clarified "numeric/sane" validation answer. User-submitted entries are
 * NOT required to be internally kcal-consistent (protein*4 + carbs*4 +
 * fat*9 ≈ kcal) -- that check is explicitly "nice but not mandatory" per
 * the clarified spec; an admin verifies later (source='user',
 * verified=false). */
export const MAX_KCAL_PER_100G = 900;
export const MAX_MACRO_GRAMS_PER_100G = 100;

/** Upper bound for a product's reference price in RSD -- generous enough for
 * any realistic packaged product (matches the `numeric(10,2)` column's ceiling
 * headroom in `0012_food_price.sql`) while still rejecting an obviously
 * fat-fingered value. Price is OPTIONAL: an empty string / undefined means "not
 * provided," same treatment as `brand`/`barcode`. */
export const MAX_PRICE_RSD = 1_000_000;

/** An empty string is treated as "not provided" for optional fields
 * (brand, barcode) -- a bare HTML text input naturally produces `""`, not
 * `undefined`, when left blank. */
const optionalTrimmedString = (maxLength: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(maxLength, tooLongMessage)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));

export const newFoodEntrySchema = z.object({
  name_sr: z
    .string({ message: FOOD_NAME_REQUIRED_ERROR_SR })
    .trim()
    .min(1, FOOD_NAME_REQUIRED_ERROR_SR)
    .max(200, FOOD_NAME_TOO_LONG_ERROR_SR),
  brand: optionalTrimmedString(200, FOOD_BRAND_TOO_LONG_ERROR_SR),
  // A user-submitted barcode is optional (the form may be reached without
  // a scan, e.g. a direct/bookmarked visit) -- but when present, must be a
  // syntactically valid 13/8-digit GTIN, same shape F031's scan flow emits.
  barcode: z
    .union([gtinSchema, z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  kcal_100g: z
    .number({ message: FOOD_KCAL_INVALID_ERROR_SR })
    .finite({ message: FOOD_KCAL_INVALID_ERROR_SR })
    .min(0, FOOD_KCAL_INVALID_ERROR_SR)
    .max(MAX_KCAL_PER_100G, FOOD_KCAL_INVALID_ERROR_SR),
  protein_100g: z
    .number({ message: FOOD_PROTEIN_INVALID_ERROR_SR })
    .finite({ message: FOOD_PROTEIN_INVALID_ERROR_SR })
    .min(0, FOOD_PROTEIN_INVALID_ERROR_SR)
    .max(MAX_MACRO_GRAMS_PER_100G, FOOD_PROTEIN_INVALID_ERROR_SR),
  carbs_100g: z
    .number({ message: FOOD_CARBS_INVALID_ERROR_SR })
    .finite({ message: FOOD_CARBS_INVALID_ERROR_SR })
    .min(0, FOOD_CARBS_INVALID_ERROR_SR)
    .max(MAX_MACRO_GRAMS_PER_100G, FOOD_CARBS_INVALID_ERROR_SR),
  fat_100g: z
    .number({ message: FOOD_FAT_INVALID_ERROR_SR })
    .finite({ message: FOOD_FAT_INVALID_ERROR_SR })
    .min(0, FOOD_FAT_INVALID_ERROR_SR)
    .max(MAX_MACRO_GRAMS_PER_100G, FOOD_FAT_INVALID_ERROR_SR),
  // Optional reference price in RSD for the whole product (not per 100 g).
  // Omitted (undefined) when the user leaves the field blank -- the client
  // simply doesn't include the key, same "empty -> not provided" treatment as
  // brand/barcode above.
  price: z
    .number({ message: FOOD_PRICE_INVALID_ERROR_SR })
    .finite({ message: FOOD_PRICE_INVALID_ERROR_SR })
    .min(0, FOOD_PRICE_INVALID_ERROR_SR)
    .max(MAX_PRICE_RSD, FOOD_PRICE_INVALID_ERROR_SR)
    .optional(),
});

export type NewFoodEntryInput = z.input<typeof newFoodEntrySchema>;
export type NewFoodEntry = z.output<typeof newFoodEntrySchema>;

export type CreateFoodResult =
  | { ok: true; data: Food }
  | {
      ok: false;
      error_sr: string;
      status: 400 | 409 | 500;
      existingFoodId?: string;
    };

/** True if `error` is Postgres' `unique_violation` (SQLSTATE 23505) --
 * exactly what `foods.barcode`'s UNIQUE constraint raises on a second
 * insert with an already-used barcode (AS-057, see
 * `supabase/migrations/0004_foods_logs.sql`). */
export function isUniqueBarcodeViolation(error: {
  code?: string | null;
}): boolean {
  return error.code === "23505";
}

/**
 * Validates a raw new-product submission and inserts it into `public.foods`
 * as `source: 'user'`, `verified: false`, `submitted_by: params.submittedBy`
 * -- a crowd-sourced entry immediately visible to every authenticated user
 * via BOTH `foods_select_all_authenticated` RLS-governed reads (AS-056: the
 * barcode-lookup route and the search RPC both simply `select` from this
 * same table/RLS policy, so nothing else needs to happen for the new row to
 * be found by either path the instant this insert commits).
 *
 * `supabase` MUST be the CALLER's session-bound (RLS) client, never the
 * admin client -- `foods_insert_authenticated` RLS (`with check
 * (submitted_by is null or submitted_by = auth.uid())`) is what actually
 * enforces "a user can only ever attribute a submission to themselves," not
 * application code re-implementing that check.
 *
 * AS-057: a duplicate `barcode` is rejected by the database's UNIQUE
 * constraint, not application-level pre-checking (a pre-check-then-insert
 * would itself be a race condition under concurrent submissions) -- this
 * function catches the resulting `23505` error and returns a friendly
 * Serbian message instead of ever throwing/crashing. When the duplicate
 * barcode is known, this also looks up the EXISTING food's id (via the same
 * session-scoped client, so still RLS-governed) so the caller can offer
 * "open the existing product instead."
 */
export async function createFoodEntry(
  supabase: SupabaseClient<Database>,
  params: { submittedBy: string; entry: unknown }
): Promise<CreateFoodResult> {
  const parsed = newFoodEntrySchema.safeParse(params.entry);
  if (!parsed.success) {
    const errorSr =
      parsed.error.issues[0]?.message ?? MALFORMED_FOOD_REQUEST_ERROR_SR;
    return { ok: false, error_sr: errorSr, status: 400 };
  }

  const {
    name_sr,
    brand,
    barcode,
    kcal_100g,
    protein_100g,
    carbs_100g,
    fat_100g,
    price,
  } = parsed.data;

  const { data, error } = await supabase
    .from("foods")
    .insert({
      name_sr,
      brand: brand ?? null,
      barcode: barcode ?? null,
      price: price ?? null,
      kcal_100g,
      protein_100g,
      carbs_100g,
      fat_100g,
      common_units: [],
      source: "user",
      verified: false,
      submitted_by: params.submittedBy,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueBarcodeViolation(error)) {
      let existingFoodId: string | undefined;
      if (barcode) {
        const { data: existing } = await supabase
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
    return { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR, status: 500 };
  }
  if (!data) {
    return { ok: false, error_sr: FOOD_CREATE_FAILED_ERROR_SR, status: 500 };
  }

  return { ok: true, data };
}
