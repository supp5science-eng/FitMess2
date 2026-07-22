import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

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
