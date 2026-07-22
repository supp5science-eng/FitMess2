import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

/**
 * Koraci: the home screen's step read for a single Belgrade calendar day.
 *
 * Mirrors `src/lib/water/water.ts`'s `getWaterMl`: one round trip on the
 * CALLER's session-bound (RLS) client, returning `{ steps, error }` and never
 * throwing. `step_counts_select_own` RLS enforces "own data only", not this
 * function. A day with no row yet resolves to `steps: 0` (not an error) so the
 * home card just shows "0" rather than a broken state.
 */
export interface StepsResult {
  steps: number;
  error: { message: string } | null;
}

export async function getStepsForDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  dayKey: string
): Promise<StepsResult> {
  const { data, error } = await supabase
    .from("step_counts")
    .select("steps")
    .eq("user_id", userId)
    .eq("day", dayKey)
    .maybeSingle();

  if (error) {
    return { steps: 0, error: { message: error.message } };
  }

  return { steps: data?.steps ?? 0, error: null };
}
