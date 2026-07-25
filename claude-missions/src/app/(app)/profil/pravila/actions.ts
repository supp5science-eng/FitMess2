"use server";

import { createClient } from "@/lib/supabase/server";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { toggleHabitCheck } from "@/lib/habits/checks";
import type { ToggleHabitResult } from "@/lib/habits/checks";
import { regenerateRules, updateRules } from "@/lib/profil/rules-settings";
import type { RegenerateRulesResult, UpdateRulesResult } from "@/lib/profil/rules-settings";
import type { PersistedRule } from "@/lib/budget/rules";

const SESSION_EXPIRED_ERROR_SR = "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";

/**
 * F017 / AS-029: persists the whole (possibly toggled/edited) rule array
 * for the current user. Thin `"use server"` wrapper -- same shape as
 * F016's `saveOnboardingAction`: resolves the signed-in user via the
 * session-bound `createClient()`, delegates the actual re-validate + write
 * to `updateRules` (kept framework-free so it's directly testable, see
 * that file's header comment).
 */
export async function updateRulesAction(
  rules: PersistedRule[]
): Promise<UpdateRulesResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  return updateRules(supabase, user.id, rules);
}

/**
 * F017 / AS-029 (empty-state next action + "Generiši ponovo" refresh):
 * recomputes and persists a fresh rule set from the current user's
 * profile + latest target, returning the new rules so the client can
 * update its optimistic state without a full page reload.
 */
export async function regenerateRulesAction(): Promise<RegenerateRulesResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  return regenerateRules(supabase, user.id);
}

/**
 * Checks a habit off for TODAY (or un-checks it). The day is resolved on the
 * server via `toBelgradeCalendarDay` rather than sent by the client: a phone
 * whose clock or timezone is off would otherwise write check-offs onto the
 * wrong day and quietly corrupt the streak.
 */
export async function toggleHabitAction(
  habitId: string,
  done: boolean
): Promise<ToggleHabitResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  return toggleHabitCheck(
    supabase,
    user.id,
    habitId,
    toBelgradeCalendarDay(),
    done
  );
}
