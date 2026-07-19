import type { SupabaseClient } from "@supabase/supabase-js";

import { startOfBelgradeDay } from "@/lib/dates";
import type { MealLogItem } from "@/lib/log/group";
import type { Database } from "@/lib/types/db";

/**
 * Meal-history read for `/analitika`'s "Svi obroci" section: the user's
 * logged meals over a trailing window (default 30 days -- the app only ever
 * SHOWS the last 30 days). Rows are retained in the DB longer (pruned after
 * 3 months server-side, see `supabase/migrations/0010_logs_retention.sql`),
 * but this view never reaches past 30 days. Session-bound RLS client;
 * `logs_select_own` enforces "own rows only". Newest first.
 *
 * Only the fields the list renders are selected -- no foods join (the meal
 * name/macros are denormalized onto the log row at log time).
 */
export const HISTORY_WINDOW_DAYS = 30;

export interface MealHistoryResult {
  data: MealLogItem[] | null;
  error: { message: string } | null;
}

export async function getMealHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
  windowDays: number = HISTORY_WINDOW_DAYS
): Promise<MealHistoryResult> {
  // Start at Belgrade midnight `windowDays - 1` days ago so the window covers
  // whole calendar days (today included) rather than a rolling 30*24h.
  const todayStart = startOfBelgradeDay(now);
  const windowStart = new Date(
    todayStart.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from("logs")
    .select("id, name, grams, kcal, protein, carbs, fat, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", windowStart.toISOString())
    .order("logged_at", { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data ?? [], error: null };
}
