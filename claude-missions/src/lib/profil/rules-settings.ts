/**
 * F017: the actual read/write logic behind `/profil/pravila` (AS-029).
 *
 * Deliberately factored out of the `"use server"` actions
 * (`src/app/(app)/profil/pravila/actions.ts`) into plain functions taking a
 * `SupabaseClient<Database>` + `userId`, mirroring F016's
 * `persistOnboarding` shape (`src/lib/onboarding/persist.ts`) -- so both
 * functions here can be exercised directly against a real, signed-in
 * Supabase client in an integration test without a running Next server /
 * `next/headers` request context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { bmr, macroTargets, planGoalAdjustment, tdee } from "@/lib/budget/engine";
import {
  generateRules,
  persistedRulesArraySchema,
  toPersistedRules,
} from "@/lib/budget/rules";
import type { PersistedRule } from "@/lib/budget/rules";
import type { Database } from "@/lib/types/db";

export type UpdateRulesResult = { ok: true } | { ok: false; error_sr: string };

export type RegenerateRulesResult =
  | { ok: true; rules: PersistedRule[] }
  | { ok: false; error_sr: string };

const GENERIC_ERROR_SR = "Nešto nije uspelo pri čuvanju. Proveri konekciju i pokušaj ponovo.";
const INVALID_RULES_ERROR_SR =
  "Pravila nisu ispravna. Osveži stranicu i pokušaj ponovo.";
const NO_PROFILE_OR_TARGET_ERROR_SR =
  "Prvo završi početni upitnik da bismo mogli da generišemo pravila.";

/**
 * Approximate current age from `profiles.birth_year` -- the inverse of
 * `src/lib/onboarding/persist.ts`'s `ageYearsToBirthYear`. Same "one-off
 * arithmetic conversion, not a day/week-boundary calculation" reasoning
 * applies (see that file's doc comment), so a plain `Date` read is fine
 * here too.
 */
function birthYearToAgeYears(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

/**
 * Re-validates the whole rule array (never trusts client-sent data --
 * same "Money-math rule"-adjacent discipline as `persistOnboarding`, even
 * though there's no arithmetic here, just shape/length validation) before
 * writing it to the caller's own row via `supabase`, which must be a
 * session-bound (RLS) client scoped to `userId` (AS-013 enforces "own row
 * only" at the database level, this function does not elevate privileges).
 */
export async function updateRules(
  supabase: SupabaseClient<Database>,
  userId: string,
  rules: PersistedRule[]
): Promise<UpdateRulesResult> {
  const parsed = persistedRulesArraySchema.safeParse(rules);
  if (!parsed.success) {
    return { ok: false, error_sr: INVALID_RULES_ERROR_SR };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ rules: parsed.data })
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error_sr: GENERIC_ERROR_SR };
  }

  return { ok: true };
}

/**
 * Recomputes a fresh 3-5 rule set for a user who already completed
 * onboarding, from their current `profiles` row + latest `targets` row --
 * used both as `/profil/pravila`'s empty-state "Generiši pravila" action
 * (a profile onboarded before this feature shipped, whose `rules` column is
 * still the migration's `'[]'::jsonb` default) and as the always-available
 * "Generiši ponovo" refresh.
 *
 * Runs the exact same F014 engine composition
 * (bmr -> tdee -> planGoalAdjustment -> macroTargets) `persistOnboarding`
 * uses, per the "Money-math rule": rule *eligibility* depends on real
 * derived numbers (macrosClamped, goalAdjusted), never re-guessed here.
 */
export async function regenerateRules(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RegenerateRulesResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("sex, birth_year, height_cm, weight_kg, activity_level")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !profile.sex ||
    !profile.birth_year ||
    !profile.height_cm ||
    !profile.weight_kg ||
    !profile.activity_level
  ) {
    return { ok: false, error_sr: NO_PROFILE_OR_TARGET_ERROR_SR };
  }

  const { data: target, error: targetError } = await supabase
    .from("targets")
    .select("goal_weight_kg, timeframe_weeks")
    .eq("user_id", userId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, error_sr: NO_PROFILE_OR_TARGET_ERROR_SR };
  }

  const ageYears = birthYearToAgeYears(profile.birth_year);
  const bmrKcal = bmr(profile.sex, profile.weight_kg, profile.height_cm, ageYears);
  const tdeeKcal = tdee(bmrKcal, profile.activity_level);
  const goal = planGoalAdjustment({
    sex: profile.sex,
    currentWeightKg: profile.weight_kg,
    targetWeightKg: target.goal_weight_kg,
    timeframeWeeks: target.timeframe_weeks,
    tdeeKcal,
  });
  const macros = macroTargets(profile.weight_kg, goal.dailyKcal);

  const templates = generateRules({
    sex: profile.sex,
    activityLevel: profile.activity_level,
    weightDeltaKg: profile.weight_kg - target.goal_weight_kg,
    timeframeWeeks: target.timeframe_weeks,
    dailyKcal: goal.dailyKcal,
    macrosClamped: macros.clamped,
    goalAdjusted: goal.adjusted,
  });
  const rules = toPersistedRules(templates);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ rules })
    .eq("user_id", userId);

  if (updateError) {
    return { ok: false, error_sr: GENERIC_ERROR_SR };
  }

  return { ok: true, rules };
}
