/**
 * F016: the actual onboarding-completion write (AS-020, AS-031).
 *
 * Deliberately factored out of the `"use server"` action
 * (`src/app/(app)/onboarding/pregled/actions.ts`) so it can be exercised
 * directly against a live, signed-in Supabase client in an integration test
 * without going through Next's Server Action RPC transport (which needs a
 * running Next server / `next/headers` request context that a plain Vitest
 * process doesn't have) -- the same "extract the pure/testable core, keep
 * the `"use server"` file a thin wrapper" shape F011's
 * `signInEmailPassword`/`src/lib/auth/core.ts` established.
 *
 * Re-validates and recomputes everything server-side rather than trusting
 * whatever the client last rendered -- the "Money-math rule"
 * (tech-decisions.md): budget/macro arithmetic is only ever produced by
 * `src/lib/budget/engine.ts` (F014), and every write here goes through the
 * caller's own session-bound (RLS) Supabase client, never the admin client,
 * so Postgres' own-row policies (AS-013) are what actually enforce "a user
 * can only write their own profile/targets" -- not just application code.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { bmr, macroTargets, planGoalAdjustment, tdee } from "@/lib/budget/engine";
import { generateRules, toPersistedRules } from "@/lib/budget/rules";
import type { Database } from "@/lib/types/db";
import type { OnboardingData } from "@/lib/onboarding/types";
import {
  validateActivityLevel,
  validateAge,
  validateGoal,
  validateHeight,
  validateSex,
  validateWeight,
} from "@/lib/onboarding/validation";

export type PersistOnboardingResult =
  | { ok: true }
  | { ok: false; error_sr: string };

const GENERIC_SAVE_ERROR_SR =
  "Nešto nije uspelo pri čuvanju. Proveri podatke i pokušaj ponovo.";

/**
 * Converts a collected age (years) into an approximate birth year for the
 * `profiles.birth_year` column -- the wizard deliberately collects age, not
 * birth year (see the F015 handoff's "Decisions made"), so this is the one
 * place that conversion happens, at persist time. Not a day/week-boundary
 * calculation (tech-decisions.md's "never raw `new Date()` day math" rule
 * is about Europe/Belgrade day/week boundaries for logging, not this
 * one-off approximate-year subtraction), so a plain `Date` read is fine.
 */
export function ageYearsToBirthYear(ageYears: number, now: Date = new Date()): number {
  return now.getFullYear() - Math.round(ageYears);
}

/**
 * Re-validates every field (never trusts client-sent data), recomputes the
 * budget via the F014 engine, then writes:
 *  - `profiles`: sex, birth_year, height_cm, weight_kg, activity_level,
 *    onboarded_at = now() (AS-031), rules = 3-5 generated eating rules
 *    (AS-028, F017's `generateRules` -- see `src/lib/budget/rules.ts`)
 *  - `targets`: a brand-new row (daily/weekly kcal + macros + goal, per the
 *    clarified spec's "history table" design -- F045/F046 insert new rows
 *    later, this is simply the first one)
 *
 * `supabase` must be a session-bound (RLS) client scoped to `userId` --
 * callers (the `"use server"` action, or a signed-in test client) are
 * responsible for that; this function does not create or elevate clients.
 */
export async function persistOnboarding(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: OnboardingData
): Promise<PersistOnboardingResult> {
  const sexResult = validateSex(data.sex);
  if (!sexResult.valid) return { ok: false, error_sr: sexResult.error };

  const ageResult = validateAge(data.ageYears);
  if (!ageResult.valid) return { ok: false, error_sr: ageResult.error };

  const heightResult = validateHeight(data.heightCm);
  if (!heightResult.valid) return { ok: false, error_sr: heightResult.error };

  const weightResult = validateWeight(data.weightKg);
  if (!weightResult.valid) return { ok: false, error_sr: weightResult.error };

  const activityResult = validateActivityLevel(data.activityLevel);
  if (!activityResult.valid)
    return { ok: false, error_sr: activityResult.error };

  const goalResult = validateGoal(
    data.targetWeightKg,
    data.timeframeWeeks,
    data.weightKg
  );
  if (!goalResult.valid) return { ok: false, error_sr: goalResult.error };

  // All six validators passed -> every field is guaranteed non-null here.
  const sex = data.sex!;
  const ageYears = data.ageYears!;
  const heightCm = data.heightCm!;
  const weightKg = data.weightKg!;
  const activityLevel = data.activityLevel!;
  const targetWeightKg = data.targetWeightKg!;
  const timeframeWeeks = data.timeframeWeeks!;

  const bmrKcal = bmr(sex, weightKg, heightCm, ageYears);
  const tdeeKcal = tdee(bmrKcal, activityLevel);
  const goal = planGoalAdjustment({
    sex,
    currentWeightKg: weightKg,
    targetWeightKg,
    timeframeWeeks,
    tdeeKcal,
  });
  const macros = macroTargets(weightKg, goal.dailyKcal);

  // F017 / AS-028: generate the user's starting eating rules from the same
  // freshly-computed profile inputs, at the exact moment onboarding
  // completes -- deterministic, no separate "generate" step for the user to
  // trigger. `generateRules` is pure (no DB access), `toPersistedRules`
  // just adds the default `enabled: true` toggle state F017's settings
  // screen (`/profil/pravila`, AS-029) then reads/writes.
  const ruleTemplates = generateRules({
    sex,
    activityLevel,
    weightDeltaKg: weightKg - targetWeightKg,
    timeframeWeeks,
    dailyKcal: goal.dailyKcal,
    macrosClamped: macros.clamped,
    goalAdjusted: goal.adjusted,
  });
  const rules = toPersistedRules(ruleTemplates);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      sex,
      birth_year: ageYearsToBirthYear(ageYears),
      height_cm: heightCm,
      weight_kg: weightKg,
      activity_level: activityLevel,
      onboarded_at: new Date().toISOString(),
      rules,
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
    goal_weight_kg: targetWeightKg,
    timeframe_weeks: timeframeWeeks,
  });

  if (targetsError) {
    return { ok: false, error_sr: GENERIC_SAVE_ERROR_SR };
  }

  return { ok: true };
}
