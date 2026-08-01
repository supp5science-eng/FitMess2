import { bmr } from "@/lib/budget/engine";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { resolveStepGoal } from "@/lib/steps/step-goal";
import { getCustomStepGoal } from "@/lib/steps/step-goal-read";
import { getStepsWeek } from "@/lib/steps/steps";
import { computeStepsWeek } from "@/lib/steps/steps-week";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutsForDay } from "@/lib/workout/workouts";

import { TreningFlow } from "./trening-flow";

// Trening: write down what you did and see what it cost.
//
// The server side prepares three things: today's already-logged sessions, the
// weight the burn is priced with, and the user's BMR -- the "mirovanje" half of
// the breakdown this screen shows. Picking the activity, the minutes and the
// intensity all happen client-side against the same pure catalog the save
// action prices with (`src/lib/workout/activities.ts`), so the number on screen
// while you choose is the number that gets stored.
//
// What this screen deliberately does NOT do is move the calorie plan. See the
// catalog's module header for why -- the short version is that the TDEE
// multiplier already pays for training, and the scale corrects it weekly.
export default async function TreningPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  // Route protection already guarantees a session; the guard only keeps a
  // missing one from throwing.
  if (!userId) {
    return <TreningFlow dayKey={toBelgradeCalendarDay(new Date())} />;
  }

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);

  // Koraci moved HERE on 2026-08-01: its card left the home screen (it was the
  // tallest thing there and inflated every pager page), which took the only
  // way to ENTER steps with it. This is where it belongs anyway -- steps and
  // workouts are the same question ("what did my body do today"), asked in two
  // units.
  const [profileResult, workouts, customStepGoal, stepsWeekRows] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("sex, weight_kg, height_cm, birth_year, activity_level")
        .eq("user_id", userId)
        .maybeSingle(),
      getWorkoutsForDay(supabase, userId, todayKey),
      getCustomStepGoal(supabase, userId),
      getStepsWeek(supabase, userId, now),
    ]);

  const profile = profileResult.data;

  // The resting half of the breakdown. An older profile without height or
  // birth year yields null, and the screen simply shows the training figure on
  // its own rather than a made-up total.
  const restingKcal =
    profile?.sex && profile.weight_kg && profile.height_cm && profile.birth_year
      ? bmr(
          profile.sex,
          profile.weight_kg,
          profile.height_cm,
          now.getUTCFullYear() - profile.birth_year
        )
      : null;

  // The user's own step goal if they set one, otherwise one derived from their
  // activity level (never a flat 10.000 -- see `src/lib/steps/step-goal.ts`).
  const stepGoal = resolveStepGoal(
    profile?.activity_level ?? null,
    customStepGoal
  ).goal;
  const stepsToday =
    stepsWeekRows.rows.find((row) => row.day === todayKey)?.steps ?? 0;
  const stepsWeek = computeStepsWeek(stepsWeekRows.rows, now, stepGoal).days.map(
    (day) => ({ label: day.label, pct: day.pct, isToday: day.isToday })
  );

  return (
    <TreningFlow
      dayKey={todayKey}
      initialWorkouts={workouts.rows}
      weightKg={profile?.weight_kg ?? null}
      restingKcal={restingKcal}
      initialSteps={stepsToday}
      stepsGoal={stepGoal}
      stepsWeek={stepsWeek}
    />
  );
}
