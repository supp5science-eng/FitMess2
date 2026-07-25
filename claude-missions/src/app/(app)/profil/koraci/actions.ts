"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { clampStepGoal } from "@/lib/steps/step-goal";
import { createClient } from "@/lib/supabase/server";

export interface SaveStepGoalResult {
  ok: boolean;
  /** The goal now in force (the automatic one when the user chose automatic). */
  goal?: number;
  error_sr?: string;
}

/**
 * Saves the "Cilj koraka" choice (`/profil/koraci`).
 *
 * `goal: null` means "automatic" -- the column goes back to NULL and the goal
 * is derived from the profile's activity level again. Any number is clamped
 * onto the allowed 500-step grid before it is written, so the DB check
 * constraint (migration 0020) can never be the thing that reports a bad value
 * to the user.
 */
export async function saveStepGoalAction(input: {
  goal: number | null;
}): Promise<SaveStepGoalResult> {
  if (input.goal != null && !Number.isFinite(input.goal)) {
    return { ok: false, error_sr: "Unesi ispravan broj koraka." };
  }

  const value = input.goal == null ? null : clampStepGoal(input.goal);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ daily_step_goal: value })
    .eq("user_id", userId);

  if (error) {
    console.error("[cilj koraka] save failed:", error.message);
    // The one failure a user can act on: the column isn't there yet.
    const missingColumn = error.message.includes("daily_step_goal");
    return {
      ok: false,
      error_sr: missingColumn
        ? "Čuvanje cilja još nije aktivno na serveru. Pokušaj kasnije."
        : "Nismo uspeli da sačuvamo cilj. Pokušaj ponovo.",
    };
  }

  return { ok: true, goal: value ?? undefined };
}
