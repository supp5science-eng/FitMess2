/**
 * Navike: the read/write side of `public.habit_checks`.
 *
 * Factored out of the `"use server"` actions (same reasoning as
 * `src/lib/profil/rules-settings.ts`): plain functions taking a
 * `SupabaseClient<Database>` + `userId`, so they can be exercised directly
 * against a real signed-in client without a Next request context.
 *
 * `supabase` must always be the session-bound (RLS) client — "own rows only"
 * is enforced by the database policies in `0018_habit_checks.sql`, never by
 * filtering here on trust.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { shiftDayKey, HABIT_HISTORY_DAYS } from "@/lib/habits/streak";
import type { HabitCheckRow } from "@/lib/habits/streak";
import type { Database } from "@/lib/types/db";

export type ToggleHabitResult =
  | { ok: true; done: boolean }
  | { ok: false; error_sr: string };

const GENERIC_ERROR_SR =
  "Nešto nije uspelo. Proveri konekciju i pokušaj ponovo.";

/**
 * Reads this user's check-offs for the last `HABIT_HISTORY_DAYS` days ending
 * at `todayKey` — one query that feeds today's checkboxes, every streak and
 * the dot rows.
 *
 * A failed read returns `[]` rather than throwing: the habits screen should
 * still render (with empty history) instead of collapsing into an error page
 * — the same "never a blank/broken screen" stance the rest of Podešavanja
 * takes.
 */
export async function getHabitChecks(
  supabase: SupabaseClient<Database>,
  userId: string,
  todayKey: string
): Promise<HabitCheckRow[]> {
  const fromKey = shiftDayKey(todayKey, -(HABIT_HISTORY_DAYS - 1));

  const { data, error } = await supabase
    .from("habit_checks")
    .select("habit_id, day")
    .eq("user_id", userId)
    .gte("day", fromKey)
    .lte("day", todayKey);

  if (error || !data) return [];

  return data;
}

/**
 * Flips one habit for one day: `done: true` inserts the check, `false`
 * deletes it. Absence is what "not done" means (see the migration comment),
 * so there is no third state to keep in sync.
 *
 * The insert uses `upsert` on the `(user_id, habit_id, day)` unique index so
 * a double tap (or a retry after a flaky connection) is a no-op rather than a
 * duplicate-key error the user would see as a failure.
 */
export async function toggleHabitCheck(
  supabase: SupabaseClient<Database>,
  userId: string,
  habitId: string,
  dayKey: string,
  done: boolean
): Promise<ToggleHabitResult> {
  if (done) {
    const { error } = await supabase
      .from("habit_checks")
      .upsert(
        { user_id: userId, habit_id: habitId, day: dayKey },
        { onConflict: "user_id,habit_id,day", ignoreDuplicates: true }
      );

    if (error) return { ok: false, error_sr: GENERIC_ERROR_SR };
    return { ok: true, done: true };
  }

  const { error } = await supabase
    .from("habit_checks")
    .delete()
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("day", dayKey);

  if (error) return { ok: false, error_sr: GENERIC_ERROR_SR };
  return { ok: true, done: false };
}
