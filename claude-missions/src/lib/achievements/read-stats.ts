import type { SupabaseClient } from "@supabase/supabase-js";

import { FULL_DAY_AWARD } from "@/lib/awards/streak";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { getLoggedDayKcals } from "@/lib/home/logged-days";
import { computeStreak } from "@/lib/streak/streak";
import { STREAK_WINDOW_DAYS } from "@/lib/streak/read-streak";
import type { Database } from "@/lib/types/db";

import { isGoalHit, type UserStats } from "./achievements";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `head: true` count of a filtered table, degrading to 0 on any error -- a
 * failed count is a badge that reads as "not yet", never a broken page. */
async function countRows(
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/**
 * Reads every aggregate the achievements screen needs, on the caller's
 * session-bound (RLS) client, in parallel. Never throws: each piece degrades
 * to 0 / no-op independently, so one failed read can't blank the screen.
 *
 * Scope note: streak + calorie-goal days are derived from the trailing
 * `STREAK_WINDOW_DAYS` window (a run/goal older than that is already past every
 * badge); meals / full days / water / steps are all-time counts.
 */
export async function getUserStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<UserStats> {
  const windowStart = new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY_MS);
  const todayKey = toBelgradeCalendarDay(now);

  const [dayKcals, totalMeals, fullDays, waterDays, stepDays, targetRow] =
    await Promise.all([
      // Per-day kcal over the window -> streak (from the day set) + goal days.
      getLoggedDayKcals(supabase, userId, windowStart, now),
      // Total meals ever.
      countRows(
        supabase
          .from("logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
      ),
      // Full days (three-meal "pun dan" awards).
      countRows(
        supabase
          .from("awards")
          .select("day", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("kind", FULL_DAY_AWARD)
      ),
      // Days with any water.
      countRows(
        supabase
          .from("water_intake")
          .select("day", { count: "exact", head: true })
          .eq("user_id", userId)
          .gt("ml", 0)
      ),
      // Days with any steps.
      countRows(
        supabase
          .from("step_counts")
          .select("day", { count: "exact", head: true })
          .eq("user_id", userId)
          .gt("steps", 0)
      ),
      // Newest daily kcal target -- the yardstick for "landed on goal".
      supabase
        .from("targets")
        .select("daily_kcal")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const streak = computeStreak([...dayKcals.keys()], todayKey);

  const targetKcal = targetRow.data?.daily_kcal ?? 0;
  const goalDays =
    targetKcal > 0
      ? [...dayKcals.values()].filter((kcal) => isGoalHit(kcal, targetKcal))
          .length
      : 0;

  return {
    currentStreak: streak.current,
    bestStreak: streak.best,
    fullDays,
    totalMeals,
    goalDays,
    waterDays,
    stepDays,
  };
}
