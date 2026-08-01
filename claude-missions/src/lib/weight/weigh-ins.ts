import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";
import {
  DEFAULT_WEIGH_IN_DAY,
  normalizeWeighInDay,
} from "@/lib/weight/weigh-in-day";
import type { WeighInPoint } from "@/lib/weight/weekly-trend";

/**
 * Nedeljno merenje: reads and writes of `public.weigh_ins` (migration 0012).
 *
 * Same posture as `src/lib/water/water.ts`: one round trip on the CALLER's
 * session-bound (RLS) client, `{ data, error }` back, never throws. The
 * `weigh_ins_*_own` policies enforce "own data only" -- not this file.
 */

/**
 * How many weigh-ins the trend engine looks at. Four weekly readings is a
 * month: long enough for a fit to see through water noise, short enough that a
 * diet changed three months ago is not still voting on today's plan.
 */
export const TREND_WEIGH_IN_LIMIT = 4;

/**
 * How many the Analitika CHART draws. Longer than the engine's window on
 * purpose: correcting a plan should only listen to the recent past, but looking
 * at one is more useful the further back it goes -- two months of dots is where
 * a person can see for themselves that a bad Tuesday means nothing.
 */
export const CHART_WEIGH_IN_LIMIT = 8;

export interface WeighInsResult {
  /** Oldest first -- the order `computeWeeklyTrend` reads most naturally. */
  points: WeighInPoint[];
  error: { message: string } | null;
}

/** The newest `TREND_WEIGH_IN_LIMIT` weigh-ins, oldest first. */
export async function getRecentWeighIns(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = TREND_WEIGH_IN_LIMIT
): Promise<WeighInsResult> {
  const { data, error } = await supabase
    .from("weigh_ins")
    .select("day, weight_kg")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(limit);

  if (error) {
    return { points: [], error: { message: error.message } };
  }

  const points = (data ?? [])
    .map((row) => ({ day: row.day, weightKg: Number(row.weight_kg) }))
    .reverse();

  return { points, error: null };
}

/**
 * Just the day of the newest weigh-in -- what the `/danas` banner needs to know
 * whether it is still waiting on one. Deliberately its own tiny query rather
 * than a slice of `getRecentWeighIns`: the home screen is the app's hottest
 * path and has no use for the weights themselves.
 *
 * A failed read reports `null`, which reads as "not weighed yet" and therefore
 * shows the banner. That is the safe direction: a nag nobody needed costs a
 * tap, a silently skipped week costs the whole feature.
 */
export async function getLastWeighInDay(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("weigh_ins")
    .select("day")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[merenje] last weigh-in read failed:", error.message);
    return null;
  }

  return data?.day ?? null;
}

/**
 * Records a weigh-in for a Belgrade calendar day. Upserts on `(user_id, day)`,
 * so stepping on the scale twice in one morning REPLACES the first reading
 * rather than stacking a duplicate that would skew the fit (AS-073).
 */
export async function saveWeighIn(
  supabase: SupabaseClient<Database>,
  userId: string,
  day: string,
  weightKg: number
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("weigh_ins")
    .upsert(
      { user_id: userId, day, weight_kg: weightKg },
      { onConflict: "user_id,day" }
    );

  return { error: error ? { message: error.message } : null };
}

/**
 * The user's chosen weigh-in weekday (`reminder_settings.weighin_day`, 0024).
 *
 * Read on its own, NOT folded into any other query -- the same reasoning as
 * `getCustomStepGoal`: until 0024 is applied on an environment, selecting this
 * column errors, and if it rode along in a bigger select that one error would
 * take the rest of the screen with it. Isolated, a missing column costs exactly
 * one thing: the schedule falls back to Sunday.
 */
export async function getWeighInDay(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("weighin_day")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[merenje] weighin_day read failed:", error.message);
    return DEFAULT_WEIGH_IN_DAY;
  }

  return normalizeWeighInDay(data?.weighin_day ?? null);
}
