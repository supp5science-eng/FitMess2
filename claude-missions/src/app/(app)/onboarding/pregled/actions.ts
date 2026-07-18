"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { persistOnboarding } from "@/lib/onboarding/persist";
import type { PersistOnboardingResult } from "@/lib/onboarding/persist";
import type { OnboardingData } from "@/lib/onboarding/types";

/**
 * F016 / AS-020, AS-031: persists onboarding, then `redirect("/danas")`.
 *
 * Invoked as a plain async Server Action from client code (not via a
 * `<form action>`). Delegates the re-validate + recompute + write to
 * `persistOnboarding` (kept framework-free so it can also be exercised
 * directly in a live integration test -- see that file's header comment).
 * From the point the write lands, `profiles.onboarded_at` is non-null, so
 * `src/middleware.ts` (F013) lets the user through without another
 * `/onboarding` bounce (AS-031). See `finishOnboardingAction` below for the
 * variant the animated plan-reveal uses (persist without redirect).
 */
export async function saveOnboardingAction(
  data: OnboardingData
): Promise<PersistOnboardingResult> {
  const result = await persistForCurrentUser(data);
  if (!result.ok) {
    return result;
  }

  redirect("/danas");
}

/**
 * Same re-validate + recompute + write as `saveOnboardingAction`, but WITHOUT
 * the trailing `redirect`. The animated plan-reveal screen
 * (`components/onboarding/plan-reveal.tsx`) persists here in the background
 * while its "računamo tvoj plan" animation plays, then navigates to `/danas`
 * itself once both the animation and this write have finished -- a
 * server-side redirect would cut the animation short. On success
 * `profiles.onboarded_at` is set, so `src/middleware.ts` lets the subsequent
 * client navigation through without bouncing back to `/onboarding`.
 */
export async function finishOnboardingAction(
  data: OnboardingData
): Promise<PersistOnboardingResult> {
  return persistForCurrentUser(data);
}

/**
 * Session-bound (RLS) persist for the signed-in user, shared by both actions
 * above. Not exported -- only the two server actions are part of the module's
 * public surface.
 */
async function persistForCurrentUser(
  data: OnboardingData
): Promise<PersistOnboardingResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error_sr: "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.",
    };
  }

  return persistOnboarding(supabase, user.id, data);
}
