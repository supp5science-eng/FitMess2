"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { persistOnboarding } from "@/lib/onboarding/persist";
import type { PersistOnboardingResult } from "@/lib/onboarding/persist";
import type { OnboardingData } from "@/lib/onboarding/types";

/**
 * F016 / AS-020, AS-031: confirms the editable onboarding summary.
 *
 * Called directly from the client `SummaryScreen` component (not via a
 * `<form action>` -- there is no natural single `FormData` shape for a
 * screen where every field is independently editable client state that
 * also drives a live recompute; Next.js Server Actions support being
 * invoked as a plain async function from client code exactly like this,
 * not only via a form's `action` prop).
 *
 * Thin wrapper: builds the session-bound (RLS) Supabase client
 * (`@/lib/supabase/server`'s `createClient`, never the admin client) and
 * resolves the current user, then delegates the actual re-validate +
 * recompute + write to `persistOnboarding` (kept framework-free so it can
 * also be exercised directly in a live integration test -- see that file's
 * header comment). On success, `redirect("/danas")` -- from this point on
 * `profiles.onboarded_at` is non-null, so `src/middleware.ts` (F013) lets
 * the user through without another `/onboarding` bounce (AS-031).
 */
export async function saveOnboardingAction(
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

  const result = await persistOnboarding(supabase, user.id, data);
  if (!result.ok) {
    return result;
  }

  redirect("/danas");
}
