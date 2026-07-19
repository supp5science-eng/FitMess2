import Link from "next/link";

import { WeeklyDashboard } from "@/components/weekly/weekly-dashboard";
import { createClient } from "@/lib/supabase/server";
import { computeWeekSummary } from "@/lib/week/summary";
import { getWeekData } from "@/lib/week/week";

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

  const result = await getWeekData(supabase, user.id);

  if (result.error) {
    console.error(
      "[F041 /analitika] getWeekData failed:",
      result.error.message
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

  const summary = computeWeekSummary(logs, target.daily_kcal);

  return <WeeklyDashboard summary={summary} />;
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
