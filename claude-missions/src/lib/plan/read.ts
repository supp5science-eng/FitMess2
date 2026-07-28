import type { SupabaseClient } from "@supabase/supabase-js";

import { getTodayRange, type DayRange } from "@/lib/home/today-range";
import type { Database, Target } from "@/lib/types/db";

/**
 * "Šta da jedeš danas" (2026-07-28): a LIGHT server read for /predlog.
 *
 * The plan only needs the newest target + today's logged macros/names -- it
 * never draws the food catalog or meal photos. So this reads exactly that in
 * two parallel, column-narrow queries, instead of `getTodayData`'s four round
 * trips (targets + logs + a `foods IN (...)` join + a `meal_photos` lookup).
 * That is the /predlog speed-up: less data, fewer trips, one warm attempt.
 *
 * Session-scoped RLS client only (`targets_select_own` / `logs_select_own`);
 * ownership is enforced in the database, not here. A cold-connection failure
 * surfaces as an error the page turns into a calm "Pokušaj ponovo" (users
 * reach /predlog from /danas, which has already warmed the connection).
 */

/** Only the target columns the plan needs. */
export type PlanTargetRow = Pick<
  Target,
  "daily_kcal" | "protein_g" | "carbs_g" | "fat_g"
>;

/** Only the log columns the plan needs (macros for totals + name for coverage). */
export interface PlanLogRow {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanData {
  target: PlanTargetRow | null;
  logs: PlanLogRow[];
}

export interface PlanDataResult {
  data: PlanData | null;
  error: { message: string } | null;
}

/** Bound each query so a hung cold connection fails fast instead of hanging. */
const QUERY_TIMEOUT_MS = 2500;

export async function getPlanData(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DayRange = getTodayRange()
): Promise<PlanDataResult> {
  const signal = AbortSignal.timeout(QUERY_TIMEOUT_MS);
  try {
    const [targetResult, logsResult] = await Promise.all([
      supabase
        .from("targets")
        .select("daily_kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", userId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .abortSignal(signal)
        .maybeSingle(),
      supabase
        .from("logs")
        .select("name, kcal, protein, carbs, fat")
        .eq("user_id", userId)
        .gte("logged_at", range.startIso)
        .lt("logged_at", range.endIsoExclusive)
        .abortSignal(signal),
    ]);

    if (targetResult.error) {
      return { data: null, error: { message: targetResult.error.message } };
    }
    if (logsResult.error) {
      return { data: null, error: { message: logsResult.error.message } };
    }

    return {
      data: {
        target: targetResult.data ?? null,
        logs: logsResult.data ?? [],
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}
