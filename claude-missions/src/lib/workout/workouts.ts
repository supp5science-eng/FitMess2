import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Workout } from "@/lib/types/db";

/**
 * Trening: reads of the `workouts` table (0026).
 *
 * Same session-bound (RLS) posture as `src/lib/steps/steps.ts` and
 * `src/lib/water/water.ts`: one round trip on the CALLER's client, a
 * `{ rows, error }` shape, and never a throw -- `workouts_select_own` is what
 * enforces "own data only", not this file.
 *
 * A day with no sessions resolves to an empty list, not an error: "I trained
 * nothing today" is the normal case, not a failure.
 *
 * Unlike steps/water this returns a LIST rather than a total -- a training day
 * is several distinct things, each editable on its own (see the migration
 * header for why the table is shaped that way).
 */

export interface WorkoutsResult {
  rows: Workout[];
  error: { message: string } | null;
}

/** A single Belgrade calendar day's sessions, oldest first (the order they
 * were logged in, which is the order they read naturally on the screen). */
export async function getWorkoutsForDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  dayKey: string
): Promise<WorkoutsResult> {
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .eq("day", dayKey)
    .order("created_at", { ascending: true });

  if (error) {
    return { rows: [], error: { message: error.message } };
  }

  return { rows: data ?? [], error: null };
}

/**
 * Just the day's kcal + minutes, for callers that only need the headline (the
 * home screen card). Kept as its own query rather than reusing
 * `getWorkoutsForDay` so `/danas` fetches two small columns instead of every
 * row in full -- it runs on the dashboard's hot path.
 */
export interface WorkoutDayTotals {
  kcal: number;
  minutes: number;
  sessions: number;
  error: { message: string } | null;
}

export async function getWorkoutTotalsForDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  dayKey: string
): Promise<WorkoutDayTotals> {
  const { data, error } = await supabase
    .from("workouts")
    .select("kcal, minutes")
    .eq("user_id", userId)
    .eq("day", dayKey);

  if (error) {
    // Degrade to "no training logged" rather than to a broken dashboard: the
    // card is an accessory, the day is not. A migration that hasn't been
    // applied to this environment yet lands here too.
    return { kcal: 0, minutes: 0, sessions: 0, error: { message: error.message } };
  }

  const rows = data ?? [];
  return {
    kcal: rows.reduce((sum, row) => sum + Math.max(0, row.kcal), 0),
    minutes: rows.reduce((sum, row) => sum + Math.max(0, row.minutes), 0),
    sessions: rows.length,
    error: null,
  };
}
