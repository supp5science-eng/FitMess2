import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cyrillicToLatin } from "@/lib/food/translit";
import type { Database, Food } from "@/lib/types/db";

// F023: deterministic query-normalization/validation helpers + the RPC call
// wrapper for `GET /api/foods/search` (src/app/api/foods/search/route.ts).
// Split the same way F021's src/lib/food/seed.ts and F022's
// src/lib/food/off.ts split pure logic from I/O, per the clarified
// "deterministic helpers factored into src/lib/" pattern.
//
// Covers AS-036 (Latin-script name search returns the matching food),
// AS-037 (Cyrillic input returns foods stored with Latin names --
// `normalizeSearchQuery` runs every query through `cyrillicToLatin` before
// it reaches the DB), and AS-038 (a one-character typo still returns the
// intended food -- proven by `public.search_foods()`'s pg_trgm
// similarity/word_similarity tuning, see
// supabase/migrations/0005_food_search.sql).

/** Bounded result-list size, matching the clarified "bounded list (e.g.
 * 20)" scope answer and `public.search_foods()`'s own default/clamp. */
export const MAX_SEARCH_RESULTS = 20;

export const SEARCH_QUERY_TOO_SHORT_ERROR_SR =
  "Upiši naziv namirnice za pretragu.";
export const SEARCH_QUERY_TOO_LONG_ERROR_SR = "Pretraga je predugačka.";

/** zod schema for the raw `q` query-string parameter: a non-empty,
 * reasonably-bounded string. Trimmed before length validation so
 * whitespace-only input is rejected the same as empty input. */
export const searchQuerySchema = z
  .string({ message: SEARCH_QUERY_TOO_SHORT_ERROR_SR })
  .trim()
  .min(1, SEARCH_QUERY_TOO_SHORT_ERROR_SR)
  .max(100, SEARCH_QUERY_TOO_LONG_ERROR_SR);

/**
 * Normalizes a raw, already-validated user query for the search RPC: trims
 * (defense in depth -- `searchQuerySchema` already trims) and
 * transliterates Cyrillic input to Latin. Latin-script input passes through
 * unchanged (AS-036), since `cyrillicToLatin`'s lookup table only has
 * Cyrillic keys; Cyrillic input becomes the Latin spelling the `foods`
 * catalog actually stores (AS-037).
 */
export function normalizeSearchQuery(rawQuery: string): string {
  return cyrillicToLatin(rawQuery.trim());
}

export interface SearchFoodsResult {
  data: Food[] | null;
  error: { message: string } | null;
}

/**
 * Calls `public.search_foods(search_query, result_limit)` via the
 * session-scoped Supabase client (so RLS -- `foods_select_all_authenticated`
 * -- still governs visibility; this never uses the admin client). `rawQuery`
 * is normalized (trim + Cyrillic->Latin) here so every caller gets the same
 * AS-037 behaviour regardless of where the query string originated.
 */
export async function searchFoods(
  supabase: SupabaseClient<Database>,
  rawQuery: string
): Promise<SearchFoodsResult> {
  const normalized = normalizeSearchQuery(rawQuery);
  const { data, error } = await supabase.rpc("search_foods", {
    search_query: normalized,
    result_limit: MAX_SEARCH_RESULTS,
  });

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data ?? [], error: null };
}
