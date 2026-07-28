import Link from "next/link";

import { MealPlanScreen } from "@/components/plan/meal-plan-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { computeDayTotals } from "@/lib/home/totals";
import { getTodayData } from "@/lib/home/today";
import { computeMealPlan } from "@/lib/plan/plan";
import { createClient } from "@/lib/supabase/server";

// "Šta da jedeš danas" (2026-07-28): `/predlog` -- the detail screen behind the
// /danas reminder (same "compact entry -> full screen" pattern as the streak
// pill -> /dostignuca). Server Component: reads the signed-in user's newest
// target + today's logs on the session-scoped RLS client (`getTodayData`, which
// already retries a cold connection and never throws), sums today's macros
// (`computeDayTotals`), and derives the whole plan with pure `computeMealPlan`.
// Same defensive "never a blank/broken screen" posture as /danas: expired
// session and read-failure each get their own calm Serbian state.

export default async function PredlogPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <StatusState
        message="Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo."
        href="/prijava"
        linkLabel="Prijavi se"
      />
    );
  }

  const result = await getTodayData(supabase, userId);

  if (result.error || !result.data) {
    return (
      <StatusState
        message="Nismo uspeli da učitamo tvoj plan. Pokušaj ponovo."
        href="/predlog"
        linkLabel="Pokušaj ponovo"
      />
    );
  }

  const { target, logs } = result.data;

  if (!target) {
    return (
      <StatusState
        message="Cilj još nije podešen, pa ne možemo da predložimo obroke. Podesi cilj pa se vrati."
        href="/profil/cilj"
        linkLabel="Podesi cilj"
      />
    );
  }

  const totals = computeDayTotals(logs);
  const plan = computeMealPlan({
    target: {
      dailyKcal: target.daily_kcal,
      proteinG: target.protein_g,
      carbsG: target.carbs_g,
      fatG: target.fat_g,
    },
    consumed: {
      kcal: totals.kcal,
      proteinG: totals.protein,
      carbsG: totals.carbs,
      fatG: totals.fat,
    },
  });

  return <MealPlanScreen plan={plan} />;
}

function StatusState({
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
      <p role="alert" className="text-sm text-muted-foreground">
        {message}
      </p>
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {linkLabel}
      </Link>
    </main>
  );
}
