import type { SupabaseClient } from "@supabase/supabase-js";

import { bmr, macroTargets, planForGoal, tdee } from "@/lib/budget/engine";
import type { GoalType } from "@/lib/types/db";
import {
  validateGoal,
  validateGoalType,
} from "@/lib/onboarding/validation";
import type { Database } from "@/lib/types/db";

// "Promeni cilj" (`/profil/cilj`): lets an already-onboarded user change their
// GOAL (maintain / lose / gain / tone) and, for weight-change goals, the
// target weight + timeframe. Changing the goal must change the daily budget,
// so this re-runs the SAME F014 engine (`bmr` -> `tdee` -> `planForGoal` ->
// `macroTargets`) the onboarding write uses and INSERTS A NEW `targets` row
// (history-table design: newest `effective_from` wins, so `/danas` and
// `/analitika` pick it up on the next read).
//
// The user's PROFILE stats (sex/age/height/weight/activity) are NOT edited
// here -- they're read from `profiles` and only the goal changes. Everything
// is re-validated server-side and every write goes through the caller's
// session-bound (RLS) client (AS-013).

export type UpdateGoalInput = {
  goal: GoalType | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
};

export type UpdateGoalResult =
  | {
      ok: true;
      plan: { dailyKcal: number; proteinG: number; carbsG: number; fatG: number };
    }
  | { ok: false; error_sr: string };

const GENERIC_SAVE_ERROR_SR =
  "Nešto nije uspelo pri čuvanju. Proveri podatke i pokušaj ponovo.";
const MISSING_PROFILE_ERROR_SR =
  "Nedostaju ti lični podaci. Popuni ih u delu Lični podaci pa pokušaj ponovo.";

export async function updateGoal(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: UpdateGoalInput,
  now: Date = new Date()
): Promise<UpdateGoalResult> {
  const goalTypeResult = validateGoalType(input.goal);
  if (!goalTypeResult.valid)
    return { ok: false, error_sr: goalTypeResult.error };
  const goalType = input.goal!;

  // Profile stats drive the recompute -- read them fresh (never trust the
  // client for these).
  const { data: profile, error: profileReadError } = await supabase
    .from("profiles")
    .select("sex, birth_year, height_cm, weight_kg, activity_level")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileReadError) return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };
  if (
    !profile ||
    profile.sex === null ||
    profile.birth_year === null ||
    profile.height_cm === null ||
    profile.weight_kg === null ||
    profile.activity_level === null
  ) {
    return { ok: false, error_sr: MISSING_PROFILE_ERROR_SR };
  }

  const weightKg = profile.weight_kg;
  const ageYears = now.getFullYear() - profile.birth_year;

  // Weight-change goals (lose/gain) require target weight + timeframe;
  // maintain/tone eat at maintenance and carry neither.
  const isWeightChange = goalType === "lose" || goalType === "gain";
  let targetWeightKg: number | null = null;
  let timeframeWeeks: number | null = null;
  if (isWeightChange) {
    const goalResult = validateGoal(
      input.targetWeightKg,
      input.timeframeWeeks,
      weightKg,
      goalType
    );
    if (!goalResult.valid) return { ok: false, error_sr: goalResult.error };
    targetWeightKg = input.targetWeightKg!;
    timeframeWeeks = input.timeframeWeeks!;
  }

  const bmrKcal = bmr(profile.sex, weightKg, profile.height_cm, ageYears);
  const tdeeKcal = tdee(bmrKcal, profile.activity_level);
  const plan = planForGoal({
    goal: goalType,
    sex: profile.sex,
    currentWeightKg: weightKg,
    targetWeightKg,
    timeframeWeeks,
    tdeeKcal,
  });
  const macros = macroTargets(weightKg, plan.dailyKcal);

  const { error: targetsError } = await supabase.from("targets").insert({
    user_id: userId,
    daily_kcal: plan.dailyKcal,
    protein_g: macros.proteinG,
    fat_g: macros.fatG,
    carbs_g: macros.carbsG,
    weekly_kcal: plan.weeklyKcal,
    goal: goalType,
    goal_weight_kg: targetWeightKg,
    timeframe_weeks: timeframeWeeks,
  });

  if (targetsError) return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };

  return {
    ok: true,
    plan: {
      dailyKcal: plan.dailyKcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
    },
  };
}
