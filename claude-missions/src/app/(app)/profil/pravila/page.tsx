import Link from "next/link";

import { RulesScreen } from "@/components/profil/rules-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { PersistedRule } from "@/lib/budget/rules";

/**
 * F017 / AS-028, AS-029: `/profil/pravila` -- shows the 3-5 eating rules
 * generated at onboarding completion (AS-028), lets the user toggle/edit
 * them (AS-029), and shows the optional day-structure guidance card.
 *
 * Server Component reads the current user's `profiles.rules` + latest
 * `targets.daily_kcal` (per the clarified "Server-fetched props" data-shape
 * answer) and hands them to the client `RulesScreen` for interactivity.
 * `middleware.ts` (F013) already guarantees only an authenticated,
 * onboarded user reaches this route -- this page still defensively handles
 * "no session"/"read failed" rather than assuming that guarantee always
 * holds (clarified failure-handling answer: "never a blank/broken screen").
 */
export default async function PravilaPage() {
  const supabase = await createClient();
  // Local access-token verification (`getClaims`) instead of `auth.getUser()`'s
  // per-navigation network round trip -- same fast path as `/profil`.
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return <RetryErrorState message="Sesija je istekla. Prijavi se ponovo." />;
  }

  // The two reads are independent -- fetch them in parallel so the page waits
  // on one round trip, not two in series.
  const [
    { data: profile, error: profileError },
    { data: target },
  ] = await Promise.all([
    supabase.from("profiles").select("rules").eq("user_id", userId).maybeSingle(),
    supabase
      .from("targets")
      .select("daily_kcal")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError) {
    return (
      <RetryErrorState message="Nismo uspeli da učitamo tvoja pravila. Proveri konekciju i pokušaj ponovo." />
    );
  }

  const rules: PersistedRule[] = profile?.rules ?? [];

  return <RulesScreen initialRules={rules} dailyKcal={target?.daily_kcal ?? null} />;
}

function RetryErrorState({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p role="alert" data-testid="pravila-load-error" className="text-sm text-destructive">
        {message}
      </p>
      <Link
        href="/profil/pravila"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Pokušaj ponovo
      </Link>
    </main>
  );
}
