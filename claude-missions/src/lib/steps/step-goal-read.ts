import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import type { Database } from "@/lib/types/db";

/**
 * Reads the user's custom step goal (`profiles.daily_step_goal`, migration
 * 0020) on its own, NOT as part of the main profile select on `/danas`.
 *
 * Deliberate: until the migration is applied on an environment, selecting that
 * column errors -- and if the column rode along in the page's main profile
 * query, that one error would also take out `created_at`, `sex` and
 * `weight_kg`, i.e. the date strip and the water goal. Isolated here, a missing
 * column costs exactly one thing: the goal falls back to the automatic,
 * activity-derived one.
 *
 * Never throws. `null` means "no custom goal" -- which is also what a failed
 * read reports, since both lead to the same, safe behaviour.
 */
export async function getCustomStepGoal(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("daily_step_goal")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[cilj koraka] daily_step_goal read failed:", error.message);
    return null;
  }

  return data?.daily_step_goal ?? null;
}

/** How far back "your average" looks. Two weeks is long enough to survive one
 * lazy weekend and short enough to still describe the person today. */
export const SUGGESTION_WINDOW_DAYS = 14;

/**
 * The user's step totals over the last `SUGGESTION_WINDOW_DAYS` Belgrade days,
 * for the "tvoj prosek je X" suggestion on `/profil/koraci`. Days with no row
 * simply aren't returned -- a day the user never logged is not a zero-step day,
 * and averaging it in as one would drag the suggestion down for no reason.
 *
 * Never throws; a failed read means "no suggestion", not a broken page.
 */
export async function getRecentStepDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<number[]> {
  const todayKey = toBelgradeCalendarDay(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const firstKey = toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! - (SUGGESTION_WINDOW_DAYS - 1)))
  );

  const { data, error } = await supabase
    .from("step_counts")
    .select("steps")
    .eq("user_id", userId)
    .gte("day", firstKey)
    .lte("day", todayKey);

  if (error) {
    console.error("[cilj koraka] step history read failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.steps);
}
