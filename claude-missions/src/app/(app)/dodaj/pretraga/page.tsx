import Link from "next/link";

import { SearchScreen } from "@/components/food/search-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getRecentFoods } from "@/lib/food/recents";
import { createClient } from "@/lib/supabase/server";

/**
 * F024 / AS-039, AS-040: `/dodaj/pretraga` -- the food search screen.
 * `src/middleware.ts` (F013) already guarantees only an authenticated,
 * verified, onboarded user reaches this route, but this page still
 * defensively handles "no session"/"recents read failed" rather than
 * assuming that guarantee always holds (clarified failure-handling answer:
 * "never a blank/broken screen"), matching the same pattern
 * `/profil/pravila` (F017) established.
 *
 * Server Component reads the current user's recently-logged foods (AS-040)
 * via `getRecentFoods` -- a session-scoped Supabase read governed entirely
 * by `logs_select_own` RLS, so this can never surface another user's rows
 * -- and hands them to the client `SearchScreen` as server-fetched initial
 * props (clarified data-shape answer), which alone drives the interactive
 * search-as-you-type against `GET /api/foods/search` (F023).
 */
export default async function PretragaPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <RetryErrorState message="Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo." />
    );
  }

  const { data: recents, error } = await getRecentFoods(supabase, userId);

  if (error) {
    console.error("[F024 /dodaj/pretraga] getRecentFoods failed:", error.message);
  }

  // A failed recents read degrades gracefully to an empty quick-add list
  // rather than blocking the whole search screen -- search-as-you-type is
  // this page's primary function and does not depend on recents having
  // loaded successfully.
  return <SearchScreen initialRecents={recents ?? []} />;
}

function RetryErrorState({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p
        role="alert"
        data-testid="pretraga-load-error"
        className="text-sm text-destructive"
      >
        {message}
      </p>
      <Link
        href="/dodaj/pretraga"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Pokušaj ponovo
      </Link>
    </main>
  );
}
