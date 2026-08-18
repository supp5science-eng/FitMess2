import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { bmr, tdee } from "@/lib/budget/engine";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { GoalType } from "@/lib/types/db";

import { SourcesLink } from "@/components/sources/sources-link";

import { GoalForm } from "./goal-form";

// `/profil/cilj` -- change goal + plan from within Podešavanja. Server
// Component: reads the profile (to compute TDEE for the live preview) and the
// newest `targets` row (for the current goal defaults), then hands them to the
// client `GoalForm`. If the profile isn't complete yet, points the user to
// "Lični podaci" rather than rendering a broken form.
export default async function CiljPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const currentUser = await getCurrentUser(supabase);

  const backLink = (
    <Link
      href="/profil"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden={true} />
      {t("settings.title")}
    </Link>
  );

  if (!currentUser) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        {backLink}
        <p className="text-sm text-muted-foreground">
          {t("profil.sessionExpired")}
        </p>
      </main>
    );
  }

  const [{ data: profile }, { data: target }] = await Promise.all([
    supabase
      .from("profiles")
      .select("sex, birth_year, height_cm, weight_kg, activity_level")
      .eq("user_id", currentUser.id)
      .maybeSingle(),
    supabase
      .from("targets")
      .select("goal, goal_weight_kg, timeframe_weeks")
      .eq("user_id", currentUser.id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const incomplete =
    !profile ||
    profile.sex === null ||
    profile.birth_year === null ||
    profile.height_cm === null ||
    profile.weight_kg === null ||
    profile.activity_level === null;

  if (incomplete) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        {backLink}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("settings.goal")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("profil.goal.completeFirst")}
        </p>
        <Link
          href="/profil/podaci"
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {t("settings.personal")}
        </Link>
      </main>
    );
  }

  const ageYears = new Date().getFullYear() - profile.birth_year!;
  const bmrKcal = bmr(
    profile.sex!,
    profile.weight_kg!,
    profile.height_cm!,
    ageYears
  );
  const tdeeKcal = tdee(bmrKcal, profile.activity_level!);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      {backLink}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("settings.goal")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("profil.goal.currentWeight", { weight: profile.weight_kg! })}
        </p>
      </div>

      <GoalForm
        sex={profile.sex!}
        currentWeightKg={profile.weight_kg!}
        tdeeKcal={tdeeKcal}
        initialGoal={(target?.goal as GoalType | null) ?? "maintain"}
        initialTargetWeightKg={target?.goal_weight_kg ?? null}
        initialTimeframeWeeks={target?.timeframe_weeks ?? null}
      />

      {/* Guideline 1.4.1: this screen turns body stats into a calorie
          prescription, so the equations behind it are one tap away from it. */}
      <SourcesLink t={t} className="self-start" />
    </main>
  );
}
