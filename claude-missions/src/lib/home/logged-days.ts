import type { SupabaseClient } from "@supabase/supabase-js";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import type { Database } from "@/lib/types/db";

/**
 * Summed logged kcal per Belgrade calendar day (`"YYYY-MM-DD"`) in the window
 * `[fromDay, toDay]`. A day is present in the map iff the user logged at
 * least one meal on it. Drives the date strip's Apple-style mini day-rings
 * (2026-07-22 redesign): each day's ring fills with that day's kcal over the
 * daily target. One lightweight read -- just `logged_at` + `kcal` over the
 * window -- bucketed into Belgrade calendar days via the shared
 * `src/lib/dates.ts` helpers (never raw day math).
 *
 * `supabase` MUST be the caller's session-bound (RLS) client -- `logs_
 * select_own` is what scopes this to the user's own logs. Any read error
 * degrades to an empty map (the strip just shows empty rings) rather than
 * failing the whole page.
 */
export async function getLoggedDayKcals(
  supabase: SupabaseClient<Database>,
  userId: string,
  fromDay: Date,
  toDay: Date
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("logs")
    .select("logged_at, kcal")
    .eq("user_id", userId)
    .gte("logged_at", startOfBelgradeDay(fromDay).toISOString())
    .lt("logged_at", endOfBelgradeDayExclusive(toDay).toISOString());

  const days = new Map<string, number>();
  if (error || !data) return days;
  for (const row of data) {
    const key = toBelgradeCalendarDay(new Date(row.logged_at));
    days.set(key, (days.get(key) ?? 0) + row.kcal);
  }
  return days;
}
