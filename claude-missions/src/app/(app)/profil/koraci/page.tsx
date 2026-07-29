import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { ACTIVITY_LEVEL_OPTIONS } from "@/lib/onboarding/types";
import {
  getCustomStepGoal,
  getRecentStepDays,
} from "@/lib/steps/step-goal-read";
import { suggestStepGoalFromHistory } from "@/lib/steps/step-goal";
import { createClient } from "@/lib/supabase/server";
import type { ActivityLevel } from "@/lib/types/db";

import { StepGoalForm } from "./step-goal-form";

/**
 * `/profil/koraci` -- "Cilj koraka".
 *
 * The app used to measure everyone against 10.000 steps. That number is a
 * marketing artefact (the 1965 Japanese "manpo-kei" pedometer), not a clinical
 * one, and a goal a sedentary person misses every single day is a goal they
 * stop looking at. Here the user sees WHERE the number comes from and can set
 * their own -- see `src/lib/steps/step-goal.ts` for the derivation.
 */
export default async function CiljKorakaPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const userId = await getCurrentUserId(supabase);

  let activityLevel: ActivityLevel | null = null;
  let customGoal: number | null = null;
  let recentSteps: number[] = [];

  if (userId) {
    const [profile, storedGoal, history] = await Promise.all([
      supabase
        .from("profiles")
        .select("activity_level")
        .eq("user_id", userId)
        .maybeSingle(),
      // Read separately: see the note in `step-goal-read.ts` about why the new
      // column never rides along with columns the page can't do without.
      getCustomStepGoal(supabase, userId),
      getRecentStepDays(supabase, userId),
    ]);

    activityLevel = profile.data?.activity_level ?? null;
    customGoal = storedGoal;
    recentSteps = history;
  }

  const activityLabel =
    ACTIVITY_LEVEL_OPTIONS.find((option) => option.value === activityLevel)
      ?.label ?? null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("settings.title")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("settings.steps")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("profil.steps.subtitle")}
        </p>
      </div>

      <StepGoalForm
        activityLevel={activityLevel}
        activityLabel={activityLabel}
        initialCustomGoal={customGoal}
        suggestion={suggestStepGoalFromHistory(recentSteps)}
      />

      {/* Why the app no longer says 10.000 to everybody. Short, honest, and it
          answers the question the number itself provokes. */}
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("profil.steps.originTitle")}
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("profil.steps.originP1")}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("profil.steps.originP2")}
        </p>
      </section>
    </main>
  );
}
