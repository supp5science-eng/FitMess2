import type { SupabaseClient } from "@supabase/supabase-js";

import { getBelgradeWeekRange } from "@/lib/dates";
import type { Database, Log, Target } from "@/lib/types/db";

/**
 * F040/F041: the weekly dashboard's server-side data read (`/nedelja`).
 *
 * Mirrors `src/lib/home/today.ts`'s shape/posture: two parallel round trips
 * on the CALLER's session-bound (RLS) client -- the newest target row
 * ("newest target wins", same `effective_from desc limit 1` hot path as
 * `/danas`) and every log in the current Belgrade Monday..Sunday week. RLS
 * (`targets_select_own` / `logs_select_own`) is what enforces "own data
 * only", not this function. A user with no target yet resolves to
 * `target: null` and the page shows a no-plan state rather than crashing.
 *
 * Only the fields the dashboard needs are read from `logs` (`logged_at`,
 * `kcal`) -- the weekly view never joins foods, so there is no `attach-food`
 * round trip here.
 */
export interface WeekData {
  target: Target | null;
  logs: Pick<Log, "logged_at" | "kcal">[];
}

export interface WeekDataResult {
  data: WeekData | null;
  error: { message: string } | null;
}

export async function getWeekData(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<WeekDataResult> {
  const range = getBelgradeWeekRange(now);

  const [targetResult, logsResult] = await Promise.all([
    supabase
      .from("targets")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("logs")
      .select("logged_at, kcal")
      .eq("user_id", userId)
      .gte("logged_at", range.startIso)
      .lt("logged_at", range.endIsoExclusive)
      .order("logged_at", { ascending: true }),
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
}
