import Link from "next/link";

import { MealHistory } from "@/components/analytics/meal-history";
import { WeightSection } from "@/components/analytics/weight-section";
import { WeeklyDashboard } from "@/components/weekly/weekly-dashboard";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { bmr, tdee } from "@/lib/budget/engine";
import { startOfBelgradeDay, toBelgradeCalendarDay } from "@/lib/dates";
import { groupLogsByDay } from "@/lib/log/group";
import { getMealHistory } from "@/lib/log/history";
import { createClient } from "@/lib/supabase/server";
import { computeMacroWeeks } from "@/lib/week/macro-weeks";
import { getWeekData } from "@/lib/week/week";
import { computeIntakeTrend } from "@/lib/weight/intake-trend";
import { computeWeightTrend } from "@/lib/weight/trend";
import { getWeighIns } from "@/lib/weight/weigh-ins";

const DAY_MS = 24 * 60 * 60 * 1000;

// F041 / AS-068..AS-071: `/analitika` -- the analytics dashboard ("Analitika").
// The bottom nav (F005) has pointed here since it shipped. Server Component:
// reads the newest target (for the no-plan gate), the 30-day meal history, the
// weigh-ins, and the profile on the session-scoped RLS client, then derives
// every card's props with pure functions (`computeMacroWeeks`, BMI, weight
// trend) and hands them to the presentational `WeeklyDashboard`. Same defensive
// "never a blank/broken screen" posture as `/danas`: expired session, read
// failure, and no-target-yet each get their own calm Serbian state.
export default async function NedeljaPage() {
  const supabase = await createClient();
  // Identity comes from the locally-verified access token (`getClaims`), not
  // `auth.getUser()`'s per-navigation network round trip to the Auth server --
  // the same fast path the API routes and `/profil` already use.
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <RetryErrorState
        message="Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo."
        href="/prijava"
        linkLabel="Prijavi se"
      />
    );
  }

  const now = new Date();
  const [result, historyResult, weighInsResult, profileResult] =
    await Promise.all([
      getWeekData(supabase, userId, now),
      getMealHistory(supabase, userId, now),
      getWeighIns(supabase, userId, now),
      // Profile questionnaire data. `weight_kg` prefills the weigh-in sheet;
      // height + weight feed the BMI card; sex/height/weight/birth_year +
      // activity_level feed the TDEE behind the intake-trend card. A failure
      // here is non-fatal (each card degrades to its own "dopuni profil"
      // state), so it never blocks the screen.
      supabase
        .from("profiles")
        .select("sex, weight_kg, height_cm, birth_year, activity_level")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (result.error) {
    console.error(
      "[F041 /analitika] getWeekData failed:",
      result.error.message
    );
  }
  if (historyResult.error) {
    console.error(
      "[F041 /analitika] getMealHistory failed:",
      historyResult.error.message
    );
  }
  if (weighInsResult.error) {
    console.error(
      "[F042 /analitika] getWeighIns failed:",
      weighInsResult.error.message
    );
  }

  if (result.error || !result.data) {
    return (
      <RetryErrorState
        message="Nismo uspeli da učitamo tvoju nedelju. Pokušaj ponovo."
        href="/analitika"
        linkLabel="Pokušaj ponovo"
      />
    );
  }

  const { target } = result.data;

  if (!target) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Još nemaš plan ishrane. Završi upitnik pa se ovde pojavi tvoja
          nedelja.
        </p>
        <Link
          href="/danas"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Nazad na Danas
        </Link>
      </main>
    );
  }

  // "Dnevni prosek kalorija" card: build this + the 3 prior weeks (macro-stacked
  // per day, average over logged days) from the same 30-day meal-history window
  // already read above -- no extra query. Empty on a history read failure.
  const macroWeeks = computeMacroWeeks(historyResult.data ?? [], now, 4);

  // BMI (kg / m²) from the questionnaire's height + weight. Only computed when
  // both inputs are present and valid; otherwise null, and the card shows a
  // calm "dopuni profil" state instead of a number built on defaults.
  const profile = profileResult.data;
  const bmi =
    profile?.weight_kg != null &&
    profile.height_cm != null &&
    profile.height_cm > 0
      ? profile.weight_kg / (profile.height_cm / 100) ** 2
      : null;

  // "Procena težine" card: estimate a 7-day weight trend from intake. Needs the
  // maintenance calories (TDEE = BMR × activity, via the budget engine) and the
  // best-known current weight (latest weigh-in, else the profile weight). When
  // either is missing the card degrades to its own "dopuni profil" state.
  const tdeeKcal =
    profile?.sex &&
    profile.weight_kg != null &&
    profile.height_cm != null &&
    profile.birth_year != null &&
    profile.activity_level
      ? tdee(
          bmr(
            profile.sex,
            profile.weight_kg,
            profile.height_cm,
            now.getFullYear() - profile.birth_year
          ),
          profile.activity_level
        )
      : null;

  const latestWeighInKg =
    (weighInsResult.data ?? [])
      .slice()
      .sort((a, b) => a.day.localeCompare(b.day))
      .at(-1)?.weight_kg ?? null;
  const currentWeightKg = latestWeighInKg ?? profile?.weight_kg ?? null;

  const intakeTrend =
    tdeeKcal != null && currentWeightKg != null
      ? computeIntakeTrend(historyResult.data ?? [], now, {
          tdeeKcal,
          currentWeightKg,
          targetFatG: target.fat_g,
          targetProteinG: target.protein_g,
        })
      : null;

  // "Svi obroci" meal-history log: group the 30-day window by day, then split
  // into the last 7 calendar days (shown immediately) and older days (behind
  // "Prikaži više"). Degrades to no footer if the history read failed --
  // never breaks the whole screen.
  const groups = groupLogsByDay(historyResult.data ?? [], now);
  const weekCutoffKey = toBelgradeCalendarDay(
    new Date(startOfBelgradeDay(now).getTime() - 6 * DAY_MS)
  );
  const recentGroups = groups.filter((g) => g.dayKey >= weekCutoffKey);
  const olderGroups = groups.filter((g) => g.dayKey < weekCutoffKey);

  const footer =
    historyResult.error === null ? (
      <MealHistory recentGroups={recentGroups} olderGroups={olderGroups} />
    ) : null;

  // F042/F043: weight trend. Degrades to no section on a read error -- never
  // breaks the rest of the screen (same posture as the meal-history footer).
  const weightSection =
    weighInsResult.error === null ? (
      <WeightSection
        trend={computeWeightTrend(
          weighInsResult.data ?? [],
          target.goal_weight_kg,
          now
        )}
        profileWeightKg={profileResult.data?.weight_kg ?? null}
        now={now}
      />
    ) : null;

  return (
    <WeeklyDashboard
      bmi={bmi}
      macroWeeks={macroWeeks}
      intakeTrend={intakeTrend}
      weightSection={weightSection}
      footer={footer}
    />
  );
}

function RetryErrorState({
  message,
  href,
  linkLabel,
}: {
  message: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p
        role="alert"
        data-testid="analitika-load-error"
        className="text-sm text-destructive"
      >
        {message}
      </p>
      <a
        href={href}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {linkLabel}
      </a>
    </main>
  );
}
