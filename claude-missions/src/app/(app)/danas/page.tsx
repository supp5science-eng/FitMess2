import { cookies } from "next/headers";

import { HomeScreen } from "@/components/home/home-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getBelgradeDayRange, toBelgradeCalendarDay } from "@/lib/dates";
import { buildDateStrip } from "@/lib/home/date-strip";
import { getLoggedDays } from "@/lib/home/logged-days";
import { getTodayData } from "@/lib/home/today";
import { createClient } from "@/lib/supabase/server";

const SR_MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
];

/** `"YYYY-MM-DD"` -> `"17. jul"` for the meals-section heading of a past day. */
function shortDate(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${day}. ${SR_MONTHS_SHORT[month! - 1]}`;
}

/** Shifts a Belgrade calendar-day key by `n` days (noon-UTC is a robust
 * in-day instant; `Date.UTC` normalizes month/year overflow). */
function addDaysKey(key: string, n: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! + n, 12))
  );
}

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
export default async function DanasPage({
  searchParams,
}: {
  // `?dan=YYYY-MM-DD` selects which day the dashboard shows (from the date
  // strip). Absent (or invalid/future) -> today.
  searchParams: Promise<{ dan?: string | string[] }>;
}) {
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

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);

  // Which day to show: the `dan` param if it's a valid, non-future calendar
  // day, else today. (The lower bound -- can't go before sign-up -- is enforced
  // on the strip, which never links to pre-sign-up days.)
  const { dan } = await searchParams;
  const danParam = Array.isArray(dan) ? dan[0] : dan;
  const selectedKey =
    typeof danParam === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(danParam) &&
    danParam <= todayKey
      ? danParam
      : todayKey;
  const isToday = selectedKey === todayKey;

  // Belgrade day range for the selected day (noon-UTC is a robust in-day
  // instant). Fetch the day's data + the sign-up day in parallel.
  const range = getBelgradeDayRange(new Date(`${selectedKey}T12:00:00.000Z`));
  const [result, profileResult] = await Promise.all([
    getTodayData(supabase, userId, range),
    supabase
      .from("profiles")
      .select("created_at")
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

  // Date strip range: from the user's sign-up day (earliest viewable) through
  // today + 30 future days (scrollable forward "through time", though empty).
  const startKey = profileResult.data?.created_at
    ? toBelgradeCalendarDay(new Date(profileResult.data.created_at))
    : addDaysKey(todayKey, -14);
  const endKey = addDaysKey(todayKey, 30);

  // "Logged" rings only need the past window (start..today) -- future is empty.
  const loggedDays = await getLoggedDays(
    supabase,
    userId,
    new Date(`${startKey}T12:00:00.000Z`),
    now
  );

  const days = buildDateStrip({ now, selectedKey, loggedDays, startKey, endKey });

  // One-time "ring hand-off" from onboarding: the plan-reveal drops the
  // `fm_intro` cookie just before its hard navigation here (see
  // `plan-reveal.tsx`). Only ever plays for today, never a past day.
  const cookieStore = await cookies();
  const intro = isToday && cookieStore.get("fm_intro") != null;

  return (
    <HomeScreen
      initialLogs={result.data.logs}
      target={result.data.target}
      intro={intro}
      days={days}
      mealsHeading={isToday ? "Obroci danas" : `Obroci · ${shortDate(selectedKey)}`}
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
