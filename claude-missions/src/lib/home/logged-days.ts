import type { SupabaseClient } from "@supabase/supabase-js";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import type { Database } from "@/lib/types/db";

/**
 * The set of Belgrade calendar days (`"YYYY-MM-DD"`) in the window
 * `[fromDay, toDay]` on which the user logged at least one meal. Drives the
 * date strip's "logged" ring. One lightweight read -- just the `logged_at`
 * timestamps over the window -- bucketed into Belgrade calendar days via the
 * shared `src/lib/dates.ts` helpers (never raw day math).
 *
 * `supabase` MUST be the caller's session-bound (RLS) client -- `logs_
 * select_own` is what scopes this to the user's own logs. Any read error
 * degrades to an empty set (the strip just shows no logged rings) rather than
 * failing the whole page.
 */
export async function getLoggedDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  fromDay: Date,
  toDay: Date
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", startOfBelgradeDay(fromDay).toISOString())
    .lt("logged_at", endOfBelgradeDayExclusive(toDay).toISOString());

  const days = new Set<string>();
  if (error || !data) return days;
  for (const row of data) {
    days.add(toBelgradeCalendarDay(new Date(row.logged_at)));
  }
  return days;
}
