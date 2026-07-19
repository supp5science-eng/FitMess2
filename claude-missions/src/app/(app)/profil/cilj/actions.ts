"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  updateGoal,
  type UpdateGoalInput,
  type UpdateGoalResult,
} from "@/lib/profile/update-goal";
import { createClient } from "@/lib/supabase/server";

/**
 * "Promeni cilj" save (`/profil/cilj`). Thin `"use server"` wrapper: resolves
 * the caller from the session and delegates to the pure, testable
 * `updateGoal`, which re-reads the profile, re-validates, recomputes the daily
 * budget from the F014 engine, and inserts a new `targets` row.
 */
export async function saveGoalAction(
  input: UpdateGoalInput
): Promise<UpdateGoalResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }
  return updateGoal(supabase, userId, input);
}
