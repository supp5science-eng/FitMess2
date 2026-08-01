import type { SupabaseClient } from "@supabase/supabase-js";

import { getBelgradeWeekRange } from "@/lib/dates";
import {
  computeAdaptivePlan,
  computeCarryInFromLastWeek,
  type AdaptivePlan,
} from "@/lib/home/adaptive";
import type { DayAnswer } from "@/lib/home/day-trust";
import type { Database, GoalType } from "@/lib/types/db";

// The server-side read behind the adaptive plan. Lived inside
// `app/(app)/danas/page.tsx` until 2026-08-01, when `/analitika` needed the
// same numbers for its "your week is on plan" note: two screens deriving the
// week's standing from two copies of this would eventually disagree about it,
// and disagreeing with itself is the one thing a plan cannot do.

export interface AdaptivePlanReadInput {
  baseDailyTarget: number;
  sex: "male" | "female";
  goal: GoalType | null;
  /** The user's own step goal; the activity hint is added on top of it. */
  baseStepGoal: number;
  /** BMR, the line below which a day's log reads as incomplete. */
  bmrKcal: number | null;
  /** The user's own verdicts on flagged days (`fm_dani` cookie). */
  dayAnswers: Map<string, DayAnswer>;
  /** `profiles.weight_kg` -- prices the walking suggestion. */
  weightKg: number | null;
  now: Date;
}

/**
 * Fetches this week's + last week's logged kcal and derives the adaptive plan.
 * Returns null on any read error so callers degrade to the plain daily target
 * rather than failing.
 */
export async function getAdaptivePlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: AdaptivePlanReadInput
): Promise<AdaptivePlan | null> {
  const {
    baseDailyTarget,
    sex,
    goal,
    baseStepGoal,
    bmrKcal,
    dayAnswers,
    weightKg,
    now,
  } = input;

  const thisWeek = getBelgradeWeekRange(now);
  const lastWeek = getBelgradeWeekRange(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  );

  // ONE read covering both weeks, split in memory below. These used to be two
  // concurrent queries, but on `/danas` this is the LAST stage of the render --
  // it can only start once the target row has landed -- so its round trips sit
  // directly on the critical path with nothing to overlap them. Two adjacent
  // week windows are one contiguous range, so a single query returns exactly
  // the same rows.
  const { data, error } = await supabase
    .from("logs")
    .select("logged_at, kcal")
    .eq("user_id", userId)
    .gte("logged_at", lastWeek.startIso)
    .lt("logged_at", thisWeek.endIsoExclusive);

  if (error) {
    console.error("[adaptive] week logs read failed:", error.message);
    return null;
  }

  // Partition by PARSED time, never by comparing the raw strings: Postgres
  // returns `timestamptz` as "…+00:00" while these bounds are `toISOString()`'s
  // "….000Z", so a lexicographic compare would mis-sort rows across the week
  // boundary. Each row is tested against its own week's full range rather than a
  // single split point, so the result is identical to the two queries even if
  // the two windows were ever not perfectly adjacent.
  const at = (row: { logged_at: string }) => Date.parse(row.logged_at);
  const thisStart = Date.parse(thisWeek.startIso);
  const thisEnd = Date.parse(thisWeek.endIsoExclusive);
  const lastStart = Date.parse(lastWeek.startIso);
  const lastEnd = Date.parse(lastWeek.endIsoExclusive);

  const rows = data ?? [];
  const thisWeekLogs = rows.filter((r) => at(r) >= thisStart && at(r) < thisEnd);
  const lastWeekLogs = rows.filter((r) => at(r) >= lastStart && at(r) < lastEnd);

  const carryInKcal = computeCarryInFromLastWeek(
    lastWeekLogs,
    baseDailyTarget,
    { sex, bmrKcal, dayAnswers }
  );

  return computeAdaptivePlan({
    weekLogs: thisWeekLogs,
    baseDailyTarget,
    sex,
    goal,
    baseStepGoal,
    carryInKcal,
    bmrKcal,
    dayAnswers,
    weightKg,
    now,
  });
}
