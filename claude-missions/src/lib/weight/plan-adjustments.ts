import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

/**
 * Nedeljno merenje: the record of what the app suggested and what the user
 * answered (`public.plan_adjustments`, migration 0024).
 *
 * Two jobs. The obvious one is history -- "on 3 August we moved your plan from
 * 2.850 to 2.600 because your measured expenditure was 2.600" belongs in the
 * user's own data, not only in a `targets` row that says nothing about why.
 *
 * The less obvious one is silence. A user who has said "keep my current plan"
 * must not be asked the same question again next Sunday. A card that reappears
 * every week after being dismissed is a card people learn to tap past without
 * reading, and then the one week it matters, they tap past that too.
 */

/** How long a declined suggestion keeps the card quiet. */
export const DECLINE_SILENCE_DAYS = 14;

export interface LastAdjustment {
  /** Belgrade calendar day the user answered. */
  day: string;
  accepted: boolean;
}

/** The most recent answered suggestion, if any. Never throws. */
export async function getLastAdjustment(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<LastAdjustment | null> {
  const { data, error } = await supabase
    .from("plan_adjustments")
    .select("day, accepted")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[merenje] plan_adjustments read failed:", error.message);
    return null;
  }

  return data ? { day: data.day, accepted: data.accepted } : null;
}

/**
 * Whether a previous "keep my plan" is still in force.
 *
 * Only a DECLINE silences the card. An accepted change does not: the new plan
 * deserves to be measured too, and the following week's weigh-in is exactly how
 * we find out whether the correction was the right size.
 */
export function isSilenced(
  last: LastAdjustment | null,
  todayKey: string,
  silenceDays: number = DECLINE_SILENCE_DAYS
): boolean {
  if (!last || last.accepted) return false;

  const [y, m, d] = todayKey.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y!, m! - 1, d! - silenceDays))
    .toISOString()
    .slice(0, 10);

  return last.day > cutoff;
}

export interface RecordAdjustmentInput {
  day: string;
  oldKcal: number;
  newKcal: number;
  /** The `TrendStatus` that produced the suggestion. */
  reason: string;
  accepted: boolean;
  measuredTdeeKcal: number | null;
}

/** Writes the user's answer. Called only from a request the user initiated. */
export async function recordAdjustment(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: RecordAdjustmentInput
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from("plan_adjustments").insert({
    user_id: userId,
    day: input.day,
    old_kcal: input.oldKcal,
    new_kcal: input.newKcal,
    reason: input.reason,
    accepted: input.accepted,
    measured_tdee_kcal: input.measuredTdeeKcal,
  });

  return { error: error ? { message: error.message } : null };
}
