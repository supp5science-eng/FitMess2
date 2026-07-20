import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database, WeighIn } from "@/lib/types/db";

/**
 * F042/F043: the weight-trend's server-side data read (`/analitika`).
 *
 * Mirrors `src/lib/week/week.ts`'s `getWeekData` and
 * `src/lib/log/history.ts`'s `getMealHistory` posture: one round trip on the
 * CALLER's session-bound (RLS) client, returning `{ data, error }` and never
 * throwing. `weigh_ins_select_own` RLS is what enforces "own data only", not
 * this function.
 *
 * A trailing 90-day window (whole Belgrade calendar days), consistent with
 * the app's habit of never showing an unbounded history -- long enough to
 * read a real trend, short enough to keep the payload tiny. Only the two
 * fields the chart needs (`day`, `weight_kg`) are selected. Ascending by day
 * so `computeWeightTrend` gets a chronological series.
 */
export const TREND_WINDOW_DAYS = 90;

export interface WeighInsResult {
  data: Pick<WeighIn, "day" | "weight_kg">[] | null;
  error: { message: string } | null;
}

export async function getWeighIns(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
  windowDays: number = TREND_WINDOW_DAYS
): Promise<WeighInsResult> {
  // `day` is a bare Belgrade calendar date, so the window lower bound is also
  // a calendar day computed in the Belgrade frame -- `windowDays - 1` days
  // before today gives a window covering whole calendar days (today included).
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const windowStartKey = toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! - (windowDays - 1)))
  );

  const { data, error } = await supabase
    .from("weigh_ins")
    .select("day, weight_kg")
    .eq("user_id", userId)
    .gte("day", windowStartKey)
    .order("day", { ascending: true });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data ?? [], error: null };
}
