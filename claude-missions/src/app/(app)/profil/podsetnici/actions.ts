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
 * half-applied screen is not representable.
 *
 * The weekly weigh-in reminder is DISPLAYED on this screen but its day and time
 * live on `/profil/merenje` (they are not just a notification schedule — the
 * same weekday drives the `/danas` banner and the trend). Only its on/off
 * travels through here, via `saveWeighInEnabledAction`. */
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

/**
 * The weekly weigh-in switch, on its own.
 *
 * Separate from `saveRemindersAction` because it writes different columns and,
 * more importantly, because an environment without migration 0024 must fail
 * only THIS switch rather than take the two daily reminders down with it.
 */
export async function saveWeighInEnabledAction(
  enabled: boolean
): Promise<SaveReminderResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR };
  }

  const { error } = await supabase.from("reminder_settings").upsert(
    {
      user_id: userId,
      weighin_enabled: enabled,
      // Same rule as everywhere else: switching a reminder on clears the guard,
      // so turning it on 10 minutes before its time still gets you today's.
      weighin_last_sent: null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[podsetnici] save weigh-in switch failed:", error.message);
    return { ok: false, error_sr: SAVE_FAILED_ERROR_SR };
  }

  return { ok: true };
}
