import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";
import type { WaterDayInput } from "@/lib/water/water-week";

/**
 * Voda: the home screen's water read for a single Belgrade calendar day.
 *
 * Mirrors `src/lib/weight/weigh-ins.ts`'s posture: one round trip on the
 * CALLER's session-bound (RLS) client, returning `{ ml, error }` and never
 * throwing. `water_intake_select_own` RLS enforces "own data only", not this
 * function. A day with no row yet resolves to `ml: 0` (not an error) so the
 * home button just shows "0" rather than a broken state.
 */
export interface WaterResult {
  ml: number;
  error: { message: string } | null;
}

export async function getWaterMl(
  supabase: SupabaseClient<Database>,
  userId: string,
  dayKey: string
): Promise<WaterResult> {
  const { data, error } = await supabase
    .from("water_intake")
    .select("ml")
    .eq("user_id", userId)
    .eq("day", dayKey)
    .maybeSingle();

  if (error) {
    return { ml: 0, error: { message: error.message } };
  }

  return { ml: data?.ml ?? 0, error: null };
}

/**
 * Voda: the Analitika card's read of the last 7 Belgrade days of water totals.
 * Same session-bound (RLS) posture as `getWaterMl`; `water_intake_select_own`
 * enforces "own data only". Days with no row simply don't appear (the pure
 * `computeWaterWeek` fills them in as 0). Never throws.
 */
export interface WaterWeekResult {
  rows: WaterDayInput[];
  error: { message: string } | null;
}

export async function getWaterWeek(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<WaterWeekResult> {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const firstKey = toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! - 6))
  );

  const { data, error } = await supabase
    .from("water_intake")
    .select("day, ml")
    .eq("user_id", userId)
    .gte("day", firstKey)
    .lte("day", todayKey)
    .order("day", { ascending: true });

  if (error) {
    return { rows: [], error: { message: error.message } };
  }

  return { rows: data ?? [], error: null };
}
