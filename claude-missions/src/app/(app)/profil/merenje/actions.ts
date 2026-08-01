"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { normalizeWeighInDay } from "@/lib/weight/weigh-in-day";

// Nedeljno merenje: saving which day (and time) the weekly weigh-in is asked
// for. A server action for the same reason as `podsetnici/actions.ts` -- only
// this page writes these fields, and it is already a form.
//
// The schedule lives in `reminder_settings` alongside the two daily reminders
// rather than on `profiles`, because it IS a reminder schedule: a weekday, a
// wall-clock time, and the guard that stops it firing twice.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo podešavanje. Pokušaj ponovo.";
const INVALID_TIME_ERROR_SR = "Izaberi vreme podsetnika.";

export interface SaveWeighInDayResult {
  ok: boolean;
  error_sr?: string;
}

export interface WeighInPreferences {
  /** 0 = Monday .. 6 = Sunday. */
  weighInDay: number;
  /** `"HH:MM"` on the quarter hour. */
  weighInTime: string;
  pushEnabled: boolean;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);
}

export async function saveWeighInDayAction(
  preferences: WeighInPreferences
): Promise<SaveWeighInDayResult> {
  if (!isValidTime(preferences.weighInTime)) {
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
      weighin_day: normalizeWeighInDay(preferences.weighInDay),
      weighin_time: `${preferences.weighInTime}:00`,
      weighin_enabled: preferences.pushEnabled,
      // Moving the day or the time clears the once-a-day guard, so a user who
      // sets it to today at 09:50 for 10:00 still gets today's reminder.
      weighin_last_sent: null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[merenje] save weigh-in day failed:", error.message);
    return { ok: false, error_sr: SAVE_FAILED_ERROR_SR };
  }

  return { ok: true };
}
