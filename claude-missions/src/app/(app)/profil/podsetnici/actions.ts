"use server";

import { createClient } from "@/lib/supabase/server";
import { updateReminderTime } from "@/lib/profil/reminder-settings";
import type { UpdateReminderResult } from "@/lib/profil/reminder-settings";

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";

/**
 * F071 / AS-116, AS-118: saves (or, with `null`, clears) the current user's
 * daily reminder time. Thin `"use server"` wrapper over the framework-free
 * `updateReminderTime` — the exact same shape as `updateRulesAction`.
 */
export async function updateReminderTimeAction(
  time: string | null
): Promise<UpdateReminderResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  return updateReminderTime(supabase, user.id, time);
}
