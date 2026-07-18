import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Food } from "@/lib/types/db";

// F031 / AS-053 (a found barcode shows the food + portion picker): the
// deterministic GTIN-validation helper + the `foods.barcode` lookup I/O
// wrapper for `GET /api/foods/barcode/[gtin]` (see that route's header
// comment). Split the exact same way F023's `src/lib/food/search.ts` splits
// pure validation from the Supabase I/O call, per the clarified
// "deterministic helpers factored into src/lib/" pattern.
//
// F030's `BarcodeScanner` only ever emits a decoded EAN-13 or EAN-8 value
// (its own `formats` option is narrowed to exactly those two -- see that
// feature's handoff) -- `gtinSchema` accepts both lengths for the same
// reason, plus defense in depth against any other caller (a hand-typed
// value, a future format addition, etc.).

export const MALFORMED_GTIN_ERROR_SR = "Neispravan barkod.";
export const BARCODE_LOOKUP_FAILED_ERROR_SR =
  "Nismo uspeli da proverimo barkod. Pokušaj ponovo.";

/** EAN-13 or EAN-8: digits only, exactly 13 or 8 characters. Matches
 * `BarcodeScanner`'s own narrowed `formats: ["ean_13", "ean_8"]` option
 * (F030). This is intentionally NOT a full checksum validator -- a
 * checksum-invalid-but-right-length string simply will not match any row's
 * `foods.barcode` column (unique, only ever written by a real decode, an
 * admin edit, or the OFF import), so the lookup itself is the checksum in
 * practice; rejecting here is only about "is this shaped like a barcode at
 * all," not "is this a real product." */
export const gtinSchema = z
  .string({ message: MALFORMED_GTIN_ERROR_SR })
  .regex(/^(\d{13}|\d{8})$/, MALFORMED_GTIN_ERROR_SR);

export interface BarcodeLookupResult {
  data: Food | null;
  error: { message: string } | null;
}

/**
 * Looks up a single `foods` row by its unique `barcode` column via the
 * SESSION-scoped Supabase client (`foods_select_all_authenticated` RLS still
 * governs visibility -- `foods` is a shared, read-all catalog, exactly like
 * `searchFoods`/F023 -- never the admin client). Returns `{ data: null,
 * error: null }` on a genuine miss (no row with this barcode): a miss is a
 * normal, expected outcome (F032's "unknown barcode -> first-time entry"
 * flow), never an error, per the clarified "sensible empty response (null)
 * with 200" answer.
 */
export async function lookupFoodByBarcode(
  supabase: SupabaseClient<Database>,
  gtin: string
): Promise<BarcodeLookupResult> {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .eq("barcode", gtin)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data ?? null, error: null };
}
