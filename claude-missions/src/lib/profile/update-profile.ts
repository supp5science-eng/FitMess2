import type { SupabaseClient } from "@supabase/supabase-js";

import { bmr, macroTargets, planForGoal, tdee } from "@/lib/budget/engine";
import { ageYearsToBirthYear } from "@/lib/onboarding/persist";
import type { ActivityLevel, Sex } from "@/lib/onboarding/types";
import {
  validateActivityLevel,
  validateAge,
  validateHeight,
  validateName,
  validateSex,
  validateWeight,
} from "@/lib/onboarding/validation";
import type { Database } from "@/lib/types/db";

// "Izmeni podatke": lets an already-onboarded user correct their personal
// stats from Settings (`/profil/podaci`). Editing weight/height/sex/age/
// activity must actually change the daily budget, so this re-runs the SAME
// F014 engine (`bmr` -> `tdee` -> `planForGoal` -> `macroTargets`) the
// onboarding write uses and INSERTS A NEW `targets` row -- the history-table
// design (newest `effective_from` wins, so `/danas` picks it up on the next
// read; F045/F046's auto-recalc uses the same insert-a-new-row shape).
//
// The user's GOAL (lose/gain/maintain/tone + target weight + timeframe) is NOT
// edited here -- that's a separate concern -- so it's carried forward from the
// latest `targets` row and re-applied to the fresh TDEE.
//
// Everything is re-validated server-side (never trusts client input) and every
// write goes through the caller's own session-bound (RLS) client, so Postgres
// own-row policies enforce "a user can only write their own rows" (AS-013).

export type UpdateProfileInput = {
  name: string | null;
  sex: Sex | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
};

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error_sr: string };

const GENERIC_SAVE_ERROR_SR =
  "Nešto nije uspelo pri čuvanju. Proveri podatke i pokušaj ponovo.";

export async function updateProfileData(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const nameResult = validateName(input.name);
  if (!nameResult.valid) return { ok: false, error_sr: nameResult.error };

  const sexResult = validateSex(input.sex);
  if (!sexResult.valid) return { ok: false, error_sr: sexResult.error };

  const ageResult = validateAge(input.ageYears);
  if (!ageResult.valid) return { ok: false, error_sr: ageResult.error };

  const heightResult = validateHeight(input.heightCm);
  if (!heightResult.valid) return { ok: false, error_sr: heightResult.error };

  const weightResult = validateWeight(input.weightKg);
  if (!weightResult.valid) return { ok: false, error_sr: weightResult.error };

  const activityResult = validateActivityLevel(input.activityLevel);
  if (!activityResult.valid)
    return { ok: false, error_sr: activityResult.error };

  // Non-null after their validators passed.
  const fullName = input.name!.trim();
  const sex = input.sex!;
  const ageYears = input.ageYears!;
  const heightCm = input.heightCm!;
  const weightKg = input.weightKg!;
  const activityLevel = input.activityLevel!;

  // Carry the current goal forward from the newest targets row.
  const { data: latestTarget, error: targetReadError } = await supabase
    .from("targets")
    .select("goal, goal_weight_kg, timeframe_weeks")
    .eq("user_id", userId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (targetReadError) {
    return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };
  }

  const goalType = latestTarget?.goal ?? "maintain";
  let goalWeightKg = latestTarget?.goal_weight_kg ?? null;
  let timeframeWeeks = latestTarget?.timeframe_weeks ?? null;

  // If the edited weight has already met (or passed) the goal, recompute at
  // maintenance rather than producing a nonsensical deficit/surplus -- the
  // goal is, for budget purposes, achieved. The goal row itself is untouched.
  const goalAlreadyMet =
    goalWeightKg !== null &&
    ((goalType === "lose" && weightKg <= goalWeightKg) ||
      (goalType === "gain" && weightKg >= goalWeightKg));
  const effectiveGoal = goalAlreadyMet ? "maintain" : goalType;
  if (effectiveGoal === "maintain" || effectiveGoal === "tone") {
    goalWeightKg = effectiveGoal === "tone" ? goalWeightKg : null;
    timeframeWeeks = effectiveGoal === "tone" ? timeframeWeeks : null;
  }

  const bmrKcal = bmr(sex, weightKg, heightCm, ageYears);
  const tdeeKcal = tdee(bmrKcal, activityLevel);
  const goal = planForGoal({
    goal: effectiveGoal,
    sex,
    currentWeightKg: weightKg,
    targetWeightKg: goalWeightKg,
    timeframeWeeks,
    tdeeKcal,
  });
  const macros = macroTargets(weightKg, goal.dailyKcal);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      sex,
      birth_year: ageYearsToBirthYear(ageYears),
      height_cm: heightCm,
      weight_kg: weightKg,
      activity_level: activityLevel,
    })
    .eq("user_id", userId);

  if (profileError) {
    return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };
  }

  const { error: targetsError } = await supabase.from("targets").insert({
    user_id: userId,
    daily_kcal: goal.dailyKcal,
    protein_g: macros.proteinG,
    fat_g: macros.fatG,
    carbs_g: macros.carbsG,
    weekly_kcal: goal.weeklyKcal,
    goal: effectiveGoal,
    goal_weight_kg: goalWeightKg,
    timeframe_weeks: timeframeWeeks,
  });

  if (targetsError) {
    return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };
  }

  return { ok: true };
}
