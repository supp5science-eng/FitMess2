import type { SupabaseClient } from "@supabase/supabase-js";

import { bmr, tdee } from "@/lib/budget/engine";
import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  bucketDayIntake,
  classifyDay,
  plausibilityFloor,
  type DayAnswer,
} from "@/lib/home/day-trust";
import type { Database, GoalType, Sex } from "@/lib/types/db";
import {
  getLastAdjustment,
  isSilenced,
} from "@/lib/weight/plan-adjustments";
import { getRecentWeighIns, TREND_WEIGH_IN_LIMIT } from "@/lib/weight/weigh-ins";
import {
  computeWeeklyTrend,
  daysBetween,
  type TrustedDayIntake,
  type WeeklyTrendResult,
} from "@/lib/weight/weekly-trend";

/**
 * Nedeljno merenje: gathers everything `computeWeeklyTrend` needs and runs it.
 *
 * The one place in this feature that talks to the database on the read side.
 * The engine itself stays pure; this assembles its inputs -- weigh-ins, the
 * current plan, and the food log ALREADY JUDGED by `day-trust.ts`, which is
 * what keeps Law 3 ("never blame the plan for a log we don't believe") honest
 * rather than aspirational.
 *
 * Every read degrades rather than throwing: a missing profile, an unapplied
 * migration or a failed query yields INSUFFICIENT_DATA, never a broken screen.
 */

/** Extra days of log history to pull beyond the weigh-in span, so the trust
 * pass has the full first segment even when a weigh-in landed mid-day. */
const LOG_MARGIN_DAYS = 2;

export interface WeeklyReview {
  trend: WeeklyTrendResult;
  /** The `targets` row the suggestion would replace. */
  currentTarget: {
    dailyKcal: number;
    goal: GoalType | null;
    goalWeightKg: number | null;
    timeframeWeeks: number | null;
  } | null;
  /** True when the user recently said "keep my current plan" (2-week silence). */
  silenced: boolean;
  /** True when there is something to show the user a decision about. */
  hasSuggestion: boolean;
}

export async function loadWeeklyReview(
  supabase: SupabaseClient<Database>,
  userId: string,
  {
    dayAnswers = new Map<string, DayAnswer>(),
    now = new Date(),
  }: { dayAnswers?: Map<string, DayAnswer>; now?: Date } = {}
): Promise<WeeklyReview> {
  const todayKey = toBelgradeCalendarDay(now);

  const [weighInsResult, profileResult, targetResult, lastAdjustment] =
    await Promise.all([
      getRecentWeighIns(supabase, userId, TREND_WEIGH_IN_LIMIT),
      supabase
        .from("profiles")
        .select("sex, weight_kg, height_cm, birth_year, activity_level")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("targets")
        .select("daily_kcal, goal, goal_weight_kg, timeframe_weeks")
        .eq("user_id", userId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getLastAdjustment(supabase, userId),
    ]);

  const profile = profileResult.data ?? null;
  const target = targetResult.data ?? null;
  const sex: Sex = profile?.sex ?? "male";

  const currentTarget = target
    ? {
        dailyKcal: target.daily_kcal,
        goal: target.goal ?? null,
        goalWeightKg: target.goal_weight_kg ?? null,
        timeframeWeeks: target.timeframe_weeks ?? null,
      }
    : null;

  const points = weighInsResult.points;

  // What the plan PREDICTED this person burns -- the number the measurement is
  // about to contradict. Computed from the profile's own weight (the plan was
  // written against it), not from the newest weigh-in.
  const userBmr =
    profile?.sex && profile.weight_kg && profile.height_cm && profile.birth_year
      ? bmr(
          profile.sex,
          profile.weight_kg,
          profile.height_cm,
          now.getUTCFullYear() - profile.birth_year
        )
      : null;
  const plannedTdeeKcal =
    userBmr != null && profile?.activity_level
      ? tdee(userBmr, profile.activity_level)
      : null;

  const days = await loadTrustedDays(supabase, userId, points, {
    sex,
    bmrKcal: userBmr,
    dayAnswers,
  });

  const trend = computeWeeklyTrend({
    weighIns: points,
    days,
    goal: currentTarget?.goal ?? null,
    sex,
    currentDailyKcal: currentTarget?.dailyKcal ?? 0,
    plannedTdeeKcal,
  });

  const silenced = isSilenced(lastAdjustment, todayKey);

  return {
    trend,
    currentTarget,
    silenced,
    hasSuggestion: trend.suggestion !== null && !silenced,
  };
}

/**
 * The daily intake covering the weigh-in span, each day already judged as
 * trustworthy or not.
 *
 * The judgement is `day-trust.ts`'s, unchanged and un-second-guessed: a day
 * below the Goldberg-style plausibility floor (BMR, or the sex kcal floor when
 * the profile can't produce one) does not count, and a day the USER has
 * explicitly called complete does -- their answer always wins over the
 * heuristic, here exactly as on the home screen.
 */
async function loadTrustedDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  points: readonly { day: string }[],
  {
    sex,
    bmrKcal,
    dayAnswers,
  }: { sex: Sex; bmrKcal: number | null; dayAnswers: Map<string, DayAnswer> }
): Promise<TrustedDayIntake[]> {
  if (points.length < 2) return [];

  const firstDay = points[0]!.day;
  const lastDay = points[points.length - 1]!.day;
  const [y, m, d] = firstDay.split("-").map(Number);
  const fromKey = toBelgradeCalendarDay(
    new Date(Date.UTC(y!, m! - 1, d! - LOG_MARGIN_DAYS))
  );

  const { data, error } = await supabase
    .from("logs")
    .select("logged_at, kcal")
    .eq("user_id", userId)
    .gte("logged_at", `${fromKey}T00:00:00.000Z`)
    // The span end is a calendar day; add a day of slack so a log written late
    // on the final evening (Belgrade is UTC+1/+2) is never cut off.
    .lt(
      "logged_at",
      `${addDays(lastDay, 1)}T23:59:59.999Z`
    );

  if (error) {
    console.error("[merenje] span logs read failed:", error.message);
    return [];
  }

  const floor = plausibilityFloor(bmrKcal, sex);
  const buckets = bucketDayIntake(data ?? []);

  // Every calendar day in the span gets an entry, including the ones with no
  // logs at all: the engine needs to know a day was EMPTY, not merely absent.
  const out: TrustedDayIntake[] = [];
  const spanDays = daysBetween(firstDay, lastDay);
  for (let i = 0; i <= spanDays; i += 1) {
    const dayKey = addDays(firstDay, i);
    const intake = buckets.get(dayKey) ?? { dayKey, kcal: 0, logCount: 0 };
    const verdict = classifyDay(intake, floor, dayAnswers.get(dayKey) ?? null);
    out.push({ dayKey, kcal: verdict.kcal, counts: verdict.counts });
  }

  return out;
}

function addDays(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return toBelgradeCalendarDay(new Date(Date.UTC(y!, m! - 1, d! + delta)));
}
