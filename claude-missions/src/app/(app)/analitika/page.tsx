import Link from "next/link";

import { MealHistory } from "@/components/analytics/meal-history";
import { RunHistoryList } from "@/components/run/run-history-list";
import { WeeklyDashboard } from "@/components/weekly/weekly-dashboard";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { bmr, tdee } from "@/lib/budget/engine";
import { startOfBelgradeDay, toBelgradeCalendarDay } from "@/lib/dates";
import { groupLogsByDay } from "@/lib/log/group";
import { getMealHistory } from "@/lib/log/history";
import { getMicroHistory } from "@/lib/nutrition/micro-history";
import { microTargetsForKcal } from "@/lib/nutrition/micro";
import { computeMicroWeek } from "@/lib/nutrition/micro-week";
import { getStepsWeek } from "@/lib/steps/steps";
import { resolveStepGoal } from "@/lib/steps/step-goal";
import { getCustomStepGoal } from "@/lib/steps/step-goal-read";
import { computeStepsWeek } from "@/lib/steps/steps-week";
import { getLoggedDayKeys } from "@/lib/streak/read-streak";
import { computeStreak } from "@/lib/streak/streak";
import { createClient } from "@/lib/supabase/server";
import { getWaterWeek } from "@/lib/water/water";
import { computeWaterWeek, waterGoalMl } from "@/lib/water/water-week";
import { computeMacroWeeks } from "@/lib/week/macro-weeks";
import { getWeekData } from "@/lib/week/week";
import { computeIntakeTrend } from "@/lib/weight/intake-trend";

const DAY_MS = 24 * 60 * 60 * 1000;

// F041 / AS-068..AS-071: `/analitika` -- the analytics dashboard ("Analitika").
// The bottom nav (F005) has pointed here since it shipped. Server Component:
// reads the newest target (for the no-plan gate), the 30-day meal history, the
// last 7 days of water, and the profile on the session-scoped RLS client, then
// derives every card's props with pure functions (`computeMacroWeeks`, BMI,
// `computeIntakeTrend`, `computeWaterWeek`) and hands them to the presentational
// `WeeklyDashboard`. Same defensive "never a blank/broken screen" posture as
// `/danas`: expired session, read failure, and no-target-yet each get their own
// calm Serbian state.
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
  const [
    result,
    historyResult,
    microResult,
    waterResult,
    stepsResult,
    profileResult,
    customStepGoal,
    streakDays,
  ] = await Promise.all([
    getWeekData(supabase, userId, now),
    getMealHistory(supabase, userId, now),
    // Separate, narrower read: the last 7 days of logs WITH their micro
    // columns + the per-100g fallback from the catalog (see `micro-history.ts`
    // for why this isn't folded into the meal history read).
    getMicroHistory(supabase, userId, now),
    getWaterWeek(supabase, userId, now),
    getStepsWeek(supabase, userId, now),
    // Profile questionnaire data. `weight_kg` + height feed the BMI card;
    // sex/height/weight/birth_year + activity_level feed the TDEE behind the
    // intake-trend card; weight also sets the water goal. A failure here is
    // non-fatal (each card degrades to its own "dopuni profil" state), so it
    // never blocks the screen.
    supabase
      .from("profiles")
      .select("sex, weight_kg, height_cm, birth_year, activity_level")
      .eq("user_id", userId)
      .maybeSingle(),
    // Cilj koraka: read on its own so a missing column can't take the profile
    // read down with it (see `src/lib/steps/step-goal-read.ts`).
    getCustomStepGoal(supabase, userId),
    // Niz: the Belgrade days the user logged a meal on (trailing window), for
    // the streak card. Degrades to an empty set on a read error.
    getLoggedDayKeys(supabase, userId, now),
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
  if (waterResult.error) {
    console.error(
      "[Voda /analitika] getWaterWeek failed:",
      waterResult.error.message
    );
  }
  if (stepsResult.error) {
    console.error(
      "[Koraci /analitika] getStepsWeek failed:",
      stepsResult.error.message
    );
  }
  if (microResult.error) {
    console.error(
      "[Mikronutrijenti /analitika] getMicroHistory failed:",
      microResult.error.message
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

  // "Mikronutrijenti" card: fiber / sugar / sodium / saturated fat per day over
  // the last 7 days, against the SAME targets the home tab derives from the
  // calorie budget (`microTargetsForKcal`) -- so a number can never mean one
  // thing on Početna and another here. Degrades to null (a calm retry line) on
  // a read error.
  const microWeek =
    microResult.error === null
      ? computeMicroWeek(
          microResult.rows,
          now,
          microTargetsForKcal(target.daily_kcal)
        )
      : null;

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

  const currentWeightKg = profile?.weight_kg ?? null;

  const intakeTrend =
    tdeeKcal != null && currentWeightKg != null
      ? computeIntakeTrend(historyResult.data ?? [], now, {
          tdeeKcal,
          currentWeightKg,
          targetFatG: target.fat_g,
          targetProteinG: target.protein_g,
        })
      : null;

  // "Voda" card: today's hydration vs a bodyweight-based goal + a 7-day series.
  // Degrades to null (a calm empty state) on a read error.
  const waterWeek =
    waterResult.error === null
      ? computeWaterWeek(
          waterResult.rows,
          now,
          waterGoalMl(profile?.weight_kg ?? null)
        )
      : null;

  // "Koraci" card: interactive 7-day step series. Degrades to null on a read
  // error (the card then shows a calm retry message).
  const stepsWeek =
    stepsResult.error === null
      ? computeStepsWeek(
          stepsResult.rows,
          now,
          // Same goal the home screen counts toward -- one number, two screens.
          resolveStepGoal(profile?.activity_level ?? null, customStepGoal).goal
        )
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

  // Prethodna trčanja (moved here from the /trcanje tab, which is now the map).
  const { data: runRows } = await supabase
    .from("runs")
    .select("id, started_at, distance_m, duration_s, calories, route")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(20);

  const footer = (
    <>
      <RunHistoryList runs={runRows ?? []} />
      {historyResult.error === null ? (
        <MealHistory recentGroups={recentGroups} olderGroups={olderGroups} />
      ) : null}
    </>
  );

  // Niz: derived purely from the logged-day set (money-math rule). The SAME
  // computation the home screen runs, so the two screens can never disagree.
  const streak = computeStreak([...streakDays], toBelgradeCalendarDay(now));

  return (
    <WeeklyDashboard
      bmi={bmi}
      macroWeeks={macroWeeks}
      microWeek={microWeek}
      intakeTrend={intakeTrend}
      waterWeek={waterWeek}
      stepsWeek={stepsWeek}
      streak={streak}
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
