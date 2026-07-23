/**
 * F071: the reminder-settings write (AS-116, AS-118).
 *
 * Framework-free core for the `/profil/podsetnici` screen's server action —
 * same "extract the testable core, keep the `"use server"` file a thin
 * wrapper" shape as `src/lib/profil/rules-settings.ts`. Validates the chosen
 * time, then writes `profiles.reminder_time` through the caller's
 * session-bound (RLS) client. `null` disables reminders entirely (AS-118) —
 * the cron treats a NULL time as "off", so a stale push subscription row can
 * never produce a notification on its own.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/db";

export type UpdateReminderResult =
  | { ok: true }
  | { ok: false; error_sr: string };

const INVALID_TIME_ERROR_SR = "Izaberi ispravno vreme podsetnika.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo podsetnik. Pokušaj ponovo.";

/** `"HH:MM"`, 00:00–23:59 — what `<input type="time">` submits. */
export function isValidReminderTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

/**
 * Sets (or, with `null`, clears) the user's daily reminder time. Clearing
 * also resets the `reminder_last_sent_on` marker so a re-enable later today
 * can still fire today.
 */
export async function updateReminderTime(
  supabase: SupabaseClient<Database>,
  userId: string,
  time: string | null
): Promise<UpdateReminderResult> {
  if (time !== null && !isValidReminderTime(time)) {
    return { ok: false, error_sr: INVALID_TIME_ERROR_SR };
  }

  const { error } = await supabase
    .from("profiles")
    .update(
      time === null
        ? { reminder_time: null, reminder_last_sent_on: null }
        : { reminder_time: time }
    )
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error_sr: SAVE_FAILED_ERROR_SR };
  }
  return { ok: true };
}
