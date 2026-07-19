import Link from "next/link";

import { MealHistory } from "@/components/analytics/meal-history";
import { WeeklyDashboard } from "@/components/weekly/weekly-dashboard";
import { startOfBelgradeDay, toBelgradeCalendarDay } from "@/lib/dates";
import { groupLogsByDay } from "@/lib/log/group";
import { getMealHistory } from "@/lib/log/history";
import { createClient } from "@/lib/supabase/server";
import { computeWeekSummary } from "@/lib/week/summary";
import { getWeekData } from "@/lib/week/week";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <RetryErrorState
        message="Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo."
        href="/prijava"
        linkLabel="Prijavi se"
      />
    );
  }

  const now = new Date();
  const [result, historyResult] = await Promise.all([
    getWeekData(supabase, user.id, now),
    getMealHistory(supabase, user.id, now),
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

  return <WeeklyDashboard summary={summary} footer={footer} />;
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
