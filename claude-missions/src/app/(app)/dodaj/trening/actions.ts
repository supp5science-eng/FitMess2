"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_WORKOUT_MINUTES,
  MIN_WORKOUT_MINUTES,
  WORKOUT_ACTIVITIES,
  workoutKcal,
} from "@/lib/workout/activities";
import type { Workout } from "@/lib/types/db";

// Trening: server actions for logging and removing a session.
//
// The kcal figure is computed HERE, never accepted from the client: the client
// shows a live preview with the same pure function, but the stored number has
// to come from the user's real weight as the server knows it. A client that
// posted its own kcal could write anything into the record.
//
// It is also a DISPLAY figure, not allowance -- nothing in this file touches
// `targets`. See `src/lib/workout/activities.ts` for why the budget must not
// move.

const activityKeys = WORKOUT_ACTIVITIES.map((activity) => activity.key) as [
  string,
  ...string[],
];

const logWorkoutSchema = z.object({
  activityKey: z.enum(activityKeys),
  intensity: z.enum(["lako", "srednje", "jako"]),
  minutes: z.coerce
    .number()
    .int()
    .min(MIN_WORKOUT_MINUTES)
    .max(MAX_WORKOUT_MINUTES),
  /** Belgrade calendar day; absent = today. Bounded to today or the past --
   * a session cannot be logged into the future. */
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type LogWorkoutInput = z.input<typeof logWorkoutSchema>;

export type LogWorkoutResult =
  | { ok: true; workout: Workout }
  | { ok: false; error_sr: string };

export async function logWorkoutAction(
  input: LogWorkoutInput
): Promise<LogWorkoutResult> {
  const parsed = logWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error_sr: "Neispravan unos. Pokušaj ponovo." };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  const todayKey = toBelgradeCalendarDay(new Date());
  const day =
    parsed.data.day && parsed.data.day <= todayKey ? parsed.data.day : todayKey;

  // The weight the burn is priced with. A profile read failure is not fatal:
  // `workoutKcal` falls back to a mid-range mass, so the session is still
  // recorded (a missing number is recoverable, a lost entry is not).
  const { data: profile } = await supabase
    .from("profiles")
    .select("weight_kg")
    .eq("user_id", userId)
    .maybeSingle();

  const kcal = workoutKcal({
    activityKey: parsed.data.activityKey,
    intensity: parsed.data.intensity,
    minutes: parsed.data.minutes,
    weightKg: profile?.weight_kg ?? null,
  });

  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      day,
      activity_key: parsed.data.activityKey,
      intensity: parsed.data.intensity,
      minutes: parsed.data.minutes,
      kcal,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[trening] insert failed:", error?.message);
    return {
      ok: false,
      error_sr: "Nismo uspeli da sačuvamo trening. Pokušaj ponovo.",
    };
  }

  // The home screen's card reads this day's total server-side.
  revalidatePath("/danas");

  return { ok: true, workout: data };
}

export type DeleteWorkoutResult =
  | { ok: true }
  | { ok: false; error_sr: string };

export async function deleteWorkoutAction(
  workoutId: string
): Promise<DeleteWorkoutResult> {
  if (!z.string().uuid().safeParse(workoutId).success) {
    return { ok: false, error_sr: "Neispravan unos. Pokušaj ponovo." };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  // `workouts_delete_own` already restricts this to the caller's rows; the
  // explicit `user_id` filter is defense in depth, the same posture the rest
  // of the app's writes take.
  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId);

  if (error) {
    console.error("[trening] delete failed:", error.message);
    return {
      ok: false,
      error_sr: "Nismo uspeli da obrišemo trening. Pokušaj ponovo.",
    };
  }

  revalidatePath("/danas");
  return { ok: true };
}
