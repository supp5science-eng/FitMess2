import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Food } from "@/lib/types/db";

// F024 / AS-040: "recently used" foods -- derived from the signed-in user's
// OWN `logs` rows (distinct `food_id`, most-recently-logged first), used
// both to (a) rank a user's recent foods above generic matches in
// `GET /api/foods/search` results, and (b) power the "Nedavno korišćeno"
// quick-add list shown on `/dodaj/pretraga` when the search box is empty.
//
// Split the same way F023's `src/lib/food/search.ts` splits deterministic
// helpers from the Supabase I/O wrapper: the pure functions below
// (`dedupeFoodIdsByRecency`, `reorderFoodsByIds`, `rankResultsWithRecentsFirst`)
// are unit-tested with plain objects, no DB required; `getRecentFoods` is the
// thin I/O wrapper that both `src/app/api/foods/recents/route.ts` and the
// server-rendered `/dodaj/pretraga` page call, exercised by a live
// integration test the same way `searchFoods` is.

/** Bounded quick-add list size -- generous enough to feel useful without
 * turning into an unbounded scroll. */
export const RECENTS_RESULT_LIMIT = 10;

/** How many of the user's most-recent log rows to scan before de-duplicating
 * down to distinct foods -- bounds the read even for a very active logger,
 * while comfortably covering enough history to fill `RECENTS_RESULT_LIMIT`
 * distinct foods for everyone but the most repetitive-eating edge case. */
const RECENTS_LOG_SCAN_LIMIT = 100;

/** The minimal shape this module needs from a `logs` row -- callers can pass
 * the full Supabase row shape or a hand-built test fixture. */
export interface RecentLogRow {
  food_id: string | null;
}

/**
 * Reduces a most-recent-first list of log rows down to the distinct
 * `food_id`s they reference, in first-seen (i.e. most-recent-logged) order.
 * Rows with a null `food_id` (a log entry not tied to a catalog food, e.g. a
 * future free-text/AI-estimated entry) are skipped entirely -- they have
 * nothing to re-add from the food catalog.
 */
export function dedupeFoodIdsByRecency(logRows: RecentLogRow[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of logRows) {
    if (!row.food_id || seen.has(row.food_id)) continue;
    seen.add(row.food_id);
    ordered.push(row.food_id);
  }
  return ordered;
}

/**
 * Re-orders a (arbitrarily-ordered, e.g. from a Postgres `IN (...)` filter)
 * list of foods to match `orderedIds`. Any id in `orderedIds` with no
 * matching food (e.g. the food row was since deleted) is silently dropped
 * rather than producing a hole.
 */
export function reorderFoodsByIds(foods: Food[], orderedIds: string[]): Food[] {
  const byId = new Map(foods.map((food) => [food.id, food] as const));
  const ordered: Food[] = [];
  for (const id of orderedIds) {
    const food = byId.get(id);
    if (food) ordered.push(food);
  }
  return ordered;
}

/**
 * AS-040 ("ranked at the TOP of the search results, above generic matches"):
 * given a search-results list and the user's own recent-food-id order,
 * returns a new list with every result that is also a recent food moved to
 * the front (in recency order), followed by the remaining results in their
 * original (verified-first/best-match) order. Pure and DB-free -- the same
 * function drives both the merge shown to the user and its unit tests.
 */
export function rankResultsWithRecentsFirst(
  results: Food[],
  recentFoodIds: string[]
): Food[] {
  if (recentFoodIds.length === 0) return results;

  const recentRank = new Map(recentFoodIds.map((id, index) => [id, index] as const));
  const recentMatches: Food[] = [];
  const rest: Food[] = [];

  for (const food of results) {
    if (recentRank.has(food.id)) {
      recentMatches.push(food);
    } else {
      rest.push(food);
    }
  }

  recentMatches.sort(
    (a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0)
  );

  return [...recentMatches, ...rest];
}

export interface RecentFoodsResult {
  data: Food[] | null;
  error: { message: string } | null;
}

/**
 * Reads the signed-in user's distinct recently-logged foods, most-recent
 * first, bounded to `limit`. Always called with the SESSION-scoped Supabase
 * client (never the admin client) so RLS's `logs_select_own` policy (see
 * `supabase/migrations/0004_foods_logs.sql`) is what actually guarantees a
 * user only ever sees their OWN logs -- this function does not re-implement
 * that check, it relies on it, exactly like `searchFoods` relies on
 * `foods_select_all_authenticated` for the shared catalog read below.
 *
 * Two round trips (logs, then foods) rather than a single joined query:
 * `@supabase/supabase-js`'s query builder has no clean "distinct on, then
 * join" primitive, and this keeps both queries simple, RLS-governed, and
 * independently testable/joinable in application code -- the catalog's
 * `foods` table is small enough (thousands, not millions, of rows) that an
 * `IN (...)` lookup for up to `RECENTS_LOG_SCAN_LIMIT` ids is negligible
 * compared to the round-trip latency itself.
 */
export async function getRecentFoods(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = RECENTS_RESULT_LIMIT
): Promise<RecentFoodsResult> {
  const { data: logRows, error: logsError } = await supabase
    .from("logs")
    .select("food_id")
    .eq("user_id", userId)
    .not("food_id", "is", null)
    .order("logged_at", { ascending: false })
    .limit(RECENTS_LOG_SCAN_LIMIT);

  if (logsError) {
    return { data: null, error: { message: logsError.message } };
  }

  const orderedFoodIds = dedupeFoodIdsByRecency(logRows ?? []).slice(0, limit);
  if (orderedFoodIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: foodRows, error: foodsError } = await supabase
    .from("foods")
    .select("*")
    .in("id", orderedFoodIds);

  if (foodsError) {
    return { data: null, error: { message: foodsError.message } };
  }

  return { data: reorderFoodsByIds(foodRows ?? [], orderedFoodIds), error: null };
}
