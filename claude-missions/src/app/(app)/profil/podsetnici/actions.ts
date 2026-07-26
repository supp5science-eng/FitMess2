"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// Podsetnici: saving the user's own reminder preferences.
//
// A server action rather than another API route because nothing but this page
// writes these fields, and the page is already a form — the route layer exists
// for `/api/podsetnici/*`, which the SERVICE WORKER and the cron talk to and
// which therefore cannot be actions.
//
// Writes go through the session client, so `reminder_settings_*_own` RLS is the
// thing enforcing "own row"; the explicit `user_id` is just what upsert needs.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo podsetnik. Pokušaj ponovo.";
const INVALID_TIME_ERROR_SR = "Izaberi vreme podsetnika.";

export interface SaveReminderResult {
  ok: boolean;
  error_sr?: string;
}

/** Everything the screen can change, in one write — the two scheduled
 * reminders plus the earned award push. Sent whole rather than per-field so a
 * half-applied screen is not representable. */
export interface ReminderPreferences {
  morningEnabled: boolean;
  morningTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
  awardEnabled: boolean;
}

/** `"HH:MM"` on the quarter hour, 00:00–23:45. */
function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);
}

export async function saveRemindersAction(
  preferences: ReminderPreferences
): Promise<SaveReminderResult> {
  if (
    !isValidTime(preferences.morningTime) ||
    !isValidTime(preferences.eveningTime)
  ) {
    return { ok: false, error_sr: INVALID_TIME_ERROR_SR };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  const { error } = await supabase.from("reminder_settings").upsert(
    {
      user_id: userId,
      morning_enabled: preferences.morningEnabled,
      morning_time: `${preferences.morningTime}:00`,
      evening_enabled: preferences.eveningEnabled,
      evening_time: `${preferences.eveningTime}:00`,
      award_enabled: preferences.awardEnabled,
      // Turning a reminder ON (or moving its time) clears the once-a-day
      // guard, so a user who enables it at 09:50 for 10:00 still gets today's.
      morning_last_sent: null,
      evening_last_sent: null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[podsetnici] save settings failed:", error.message);
    return { ok: false, error_sr: SAVE_FAILED_ERROR_SR };
  }

  return { ok: true };
}
