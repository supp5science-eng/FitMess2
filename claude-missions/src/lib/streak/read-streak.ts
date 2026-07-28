import type { SupabaseClient } from "@supabase/supabase-js";

import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import type { Database } from "@/lib/types/db";

/**
 * How far back the streak read looks. A run longer than this is already past
 * every milestone the card celebrates, and an unbounded read would grow
 * forever for the app's most loyal users -- the same bounding the `awards`
 * streak read applies. 400 days keeps a full year of "najduži niz" in view
 * with headroom.
 */
export const STREAK_WINDOW_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The set of Belgrade calendar days (`"YYYY-MM-DD"`) in the trailing
 * `STREAK_WINDOW_DAYS`-day window on which the user logged at least one meal.
 *
 * One lean read -- just `logged_at` over the window -- bucketed into Belgrade
 * calendar days via the shared `src/lib/dates.ts` helpers (never raw day
 * math). Feeds `computeStreak` (`src/lib/streak/streak.ts`), which does all
 * the counting purely. Any read error degrades to an EMPTY set (the card just
 * shows a fresh "start your streak" state) rather than failing the whole page.
 *
 * `supabase` MUST be the caller's session-bound (RLS) client -- `logs_select_
 * own` is what scopes this to the user's own logs.
 */
export async function getLoggedDayKeys(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<Set<string>> {
  const windowStart = new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY_MS);

  const { data, error } = await supabase
    .from("logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", startOfBelgradeDay(windowStart).toISOString())
    .lt("logged_at", endOfBelgradeDayExclusive(now).toISOString());

  const days = new Set<string>();
  if (error || !data) return days;
  for (const row of data) {
    days.add(toBelgradeCalendarDay(new Date(row.logged_at)));
  }
  return days;
}
