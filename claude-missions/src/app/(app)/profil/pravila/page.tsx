import Link from "next/link";

import { HabitsScreen } from "@/components/profil/habits-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { getHabitChecks } from "@/lib/habits/checks";
import { buildHabitProgress } from "@/lib/habits/streak";
import { createClient } from "@/lib/supabase/server";
import type { PersistedRule } from "@/lib/budget/rules";

/**
 * `/profil/pravila` -- "Navike".
 *
 * Server Component: reads the habit definitions (`profiles.rules`), the last
 * 30 days of check-offs (`habit_checks`) and the current daily budget, joins
 * them into per-habit progress, and hands that to the client `HabitsScreen`.
 *
 * The route keeps its `/profil/pravila` path even though the feature is now
 * called "Navike": renaming it would break any installed PWA's cached links
 * and every existing reference for no user-visible gain.
 *
 * `middleware.ts` (F013) already guarantees only an authenticated, onboarded
 * user reaches this route -- this page still defensively handles "no
 * session" / "read failed" rather than assuming that guarantee always holds.
 */
export default async function PravilaPage() {
  const supabase = await createClient();
  const { t } = await getT();
  // Local access-token verification (`getClaims`) instead of `auth.getUser()`'s
  // per-navigation network round trip -- same fast path as `/profil`.
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return <RetryErrorState t={t} message={t("profil.sessionExpired")} />;
  }

  const todayKey = toBelgradeCalendarDay();

  // Independent reads -- one round trip, not three in series. `getHabitChecks`
  // swallows its own errors (empty history still renders a usable screen).
  const [{ data: profile, error: profileError }, { data: target }, checks] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("rules")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("targets")
        .select("daily_kcal")
        .eq("user_id", userId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getHabitChecks(supabase, userId, todayKey),
    ]);

  if (profileError) {
    return <RetryErrorState t={t} message={t("profil.habits.loadError")} />;
  }

  const rules: PersistedRule[] = profile?.rules ?? [];
  const habits = buildHabitProgress(rules, checks, todayKey);

  return (
    <HabitsScreen
      initialHabits={habits}
      initialRules={rules}
      dailyKcal={target?.daily_kcal ?? null}
    />
  );
}

function RetryErrorState({ t, message }: { t: TFunction; message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p role="alert" data-testid="pravila-load-error" className="text-sm text-destructive">
        {message}
      </p>
      <Link
        href="/profil/pravila"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {t("profil.habits.retry")}
      </Link>
    </main>
  );
}
