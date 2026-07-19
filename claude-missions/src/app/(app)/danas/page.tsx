import { cookies } from "next/headers";

import { HomeScreen } from "@/components/home/home-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTodayData } from "@/lib/home/today";
import { createClient } from "@/lib/supabase/server";

// F027 / AS-043, AS-047, AS-048, AS-049, AS-050: `/danas` -- the home
// screen, this app's primary/centerpiece view (`src/components/shell/
// bottom-nav.tsx` has pointed here since F005; F025's portion picker has
// redirected here on a successful save since it shipped, previously landing
// on a 404-shaped placeholder per that feature's own handoff).
//
// Server Component: reads the signed-in user's newest target row + today's
// logs (joined with their referenced foods) via `getTodayData`
// (session-scoped RLS client, same defensive "no session" / "read failed"
// handling `/dodaj/pretraga` (F024) and `/dodaj/porcija/[foodId]` (F025)
// already established -- clarified failure-handling answer: "never a
// blank/broken screen"), then hands the result to the client `HomeScreen`
// as server-fetched initial props, which owns the small bit of client state
// needed for AS-043 (immediate update after an edit/delete without a full
// page reload).
export default async function DanasPage() {
  const supabase = await createClient();
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

  // Fetch today's data and the greeting name concurrently -- the name read is
  // independent of today's logs/target, so it must not wait behind it.
  // Personalization: the greeting on the dashboard is the user's name,
  // collected in onboarding (`profiles.full_name`). A missing name just
  // degrades to a neutral header -- never a broken screen.
  const [result, profileResult] = await Promise.all([
    getTodayData(supabase, userId),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (result.error) {
    console.error("[F027 /danas] getTodayData failed:", result.error.message);
  }

  if (result.error || !result.data) {
    return (
      <RetryErrorState
        message="Nismo uspeli da učitamo tvoj dan. Pokušaj ponovo."
        href="/danas"
        linkLabel="Pokušaj ponovo"
      />
    );
  }

  const profile = profileResult.data;

  // One-time "ring hand-off" from onboarding: the plan-reveal drops the
  // `fm_intro` cookie just before its hard navigation here (see
  // `plan-reveal.tsx`). Presence is enough -- HomeScreen consumes/clears it
  // client-side. Everyone else gets the dashboard with no intro.
  const cookieStore = await cookies();
  const intro = cookieStore.get("fm_intro") != null;

  return (
    <HomeScreen
      initialLogs={result.data.logs}
      target={result.data.target}
      name={profile?.full_name ?? null}
      intro={intro}
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
      <p role="alert" data-testid="danas-load-error" className="text-sm text-destructive">
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
