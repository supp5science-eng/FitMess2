import type { SupabaseClient } from "@supabase/supabase-js";

import { startOfBelgradeDay } from "@/lib/dates";
import type { MicroWeekLogInput } from "@/lib/nutrition/micro-week";
import type { Database } from "@/lib/types/db";

/**
 * Micronutrient read for the Analitika "Mikronutrijenti" card: the last N
 * calendar days of logs with their fiber/sugar/sodium/sat-fat snapshot, plus the
 * per-100g values of every catalog food they reference.
 *
 * It is a SEPARATE read from `getMealHistory` on purpose: that one deliberately
 * selects only the columns the meal list renders (and joins nothing), and this
 * card needs different columns over a shorter window. Widening the history read
 * would make every Analitika visit pay for columns the list never draws.
 *
 * The foods join is what makes the AI catalog backfill work retroactively --
 * an entry logged before its food had micro data resolves through
 * `resolveLogMicros`'s per-100g fallback without ever rewriting log history
 * (`src/lib/nutrition/micro.ts`).
 *
 * Session-bound RLS client; `logs_select_own` enforces "own rows only".
 */

export const MICRO_WINDOW_DAYS = 7;

export interface MicroHistoryResult {
  rows: MicroWeekLogInput[];
  error: { message: string } | null;
}

export async function getMicroHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
  windowDays: number = MICRO_WINDOW_DAYS
): Promise<MicroHistoryResult> {
  // Start at Belgrade midnight `windowDays - 1` days ago, so the window covers
  // whole calendar days (today included) rather than a rolling N×24h -- the same
  // convention `getMealHistory` and `computeMicroWeek` use.
  const todayStart = startOfBelgradeDay(now);
  const windowStart = new Date(
    todayStart.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from("logs")
    .select("logged_at, kcal, grams, food_id, fiber, sugar, sodium, sat_fat")
    .eq("user_id", userId)
    .gte("logged_at", windowStart.toISOString())
    .order("logged_at", { ascending: false });

  if (error) {
    return { rows: [], error: { message: error.message } };
  }

  const logs = data ?? [];
  const foodIds = Array.from(
    new Set(
      logs.map((log) => log.food_id).filter((id): id is string => Boolean(id))
    )
  );

  // Per-100g fallback for entries whose own snapshot is missing. A failure here
  // is NOT fatal: the card still renders from the snapshots it already has, and
  // the entries it can't describe simply stay unknown (never zero).
  const microByFoodId = new Map<
    string,
    {
      fiber_100g?: number | null;
      sugar_100g?: number | null;
      sodium_100g?: number | null;
      sat_fat_100g?: number | null;
    }
  >();
  if (foodIds.length > 0) {
    const foodsResult = await supabase
      .from("foods")
      .select("id, fiber_100g, sugar_100g, sodium_100g, sat_fat_100g")
      .in("id", foodIds);
    for (const food of foodsResult.data ?? []) {
      microByFoodId.set(food.id, food);
    }
  }

  return {
    rows: logs.map((log) => ({
      logged_at: log.logged_at,
      kcal: log.kcal,
      grams: log.grams,
      fiber: log.fiber,
      sugar: log.sugar,
      sodium: log.sodium,
      sat_fat: log.sat_fat,
      food: log.food_id ? (microByFoodId.get(log.food_id) ?? null) : null,
    })),
    error: null,
  };
}
