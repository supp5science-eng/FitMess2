import Link from "next/link";

import { MealHistory } from "@/components/analytics/meal-history";
import { WeightSection } from "@/components/analytics/weight-section";
import { WeeklyDashboard } from "@/components/weekly/weekly-dashboard";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { startOfBelgradeDay, toBelgradeCalendarDay } from "@/lib/dates";
import { groupLogsByDay } from "@/lib/log/group";
import { getMealHistory } from "@/lib/log/history";
import { createClient } from "@/lib/supabase/server";
import { computeWeekSummary } from "@/lib/week/summary";
import { getWeekData } from "@/lib/week/week";
import { computeWeightTrend } from "@/lib/weight/trend";
import { getWeighIns } from "@/lib/weight/weigh-ins";

const DAY_MS = 24 * 60 * 60 * 1000;

// F041 / AS-068..AS-071: `/analitika` -- the analytics dashboard ("Analitika").
// The bottom nav (F005) has pointed here since it shipped. Server Component:
// reads the newest target + this Belgrade week's logs via `getWeekData`
// (session-scoped RLS client), derives the whole view with the pure
// `computeWeekSummary`, and hands a fully-computed summary to the
// presentational `WeeklyDashboard`. Same defensive "never a blank/broken
// screen" posture as `/danas`: expired session, read failure, and
// no-target-yet each get their own calm Serbian state.
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
      // Profile questionnaire data. `weight_kg` prefills the weigh-in sheet
      // before the first real weigh-in exists; height + weight feed the BMI
      // card at the top of the dashboard. A failure here is non-fatal (the
      // prefill falls back to empty and the BMI card shows its "dopuni profil"
      // state), so it never blocks the screen.
      supabase
        .from("profiles")
        .select("weight_kg, height_cm")
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

  const { target, logs } = result.data;

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

  const summary = computeWeekSummary(logs, target.daily_kcal, now);

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
      summary={summary}
      bmi={bmi}
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
