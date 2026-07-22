import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import type { StepsDayInput } from "@/lib/steps/steps-week";
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

/**
 * Koraci: the Analitika card's read of the last 7 Belgrade days of step totals.
 * Same session-bound (RLS) posture as `getStepsForDay`; `step_counts_select_own`
 * enforces "own data only". Days with no row simply don't appear (the pure
 * `computeStepsWeek` fills them in as 0). Never throws.
 */
export interface StepsWeekResult {
  rows: StepsDayInput[];
  error: { message: string } | null;
}

export async function getStepsWeek(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<StepsWeekResult> {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const firstKey = toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! - 6))
  );

  const { data, error } = await supabase
    .from("step_counts")
    .select("day, steps")
    .eq("user_id", userId)
    .gte("day", firstKey)
    .lte("day", todayKey)
    .order("day", { ascending: true });

  if (error) {
    return { rows: [], error: { message: error.message } };
  }

  return { rows: data ?? [], error: null };
}
