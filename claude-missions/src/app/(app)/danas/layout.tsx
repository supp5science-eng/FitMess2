import { Suspense } from "react";
import { cookies } from "next/headers";

import { DateStrip } from "@/components/home/date-strip";
import { StreakPill } from "@/components/streak/streak-pill";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { buildDateStrip } from "@/lib/home/date-strip";
import { getLoggedDayKcals } from "@/lib/home/logged-days";
import { getDanasProfile } from "@/lib/home/profile";
import { getLoggedDayKeys } from "@/lib/streak/read-streak";
import { computeStreak, type StreakSummary } from "@/lib/streak/streak";
import { createClient } from "@/lib/supabase/server";

/**
 * How many days BACK the strip reaches (a hard cap, independent of how long
 * ago the user signed up). The strip is a "recent days" picker -- older history
 * lives on `/analitika` -- so capping it keeps the wheel to a few dozen cells
 * instead of rendering one SVG-ring day-cell for every day since sign-up (which
 * for a long-time user was hundreds of nodes shipped in the HTML and hydrated
 * on the client, the main reason the header felt heavy on load). Six weeks
 * comfortably covers "scroll back through last month".
 */
const STRIP_LOOKBACK_DAYS = 42;
/** How many (empty, faint, non-tappable) future days the wheel can scroll into
 * past today -- just enough to see "tomorrow" ahead, not 30 dead cells. */
const STRIP_FUTURE_DAYS = 3;

// The persistent `/danas` header (2026-07-30): the FitMess wordmark, the streak
// pill, and the date WHEEL live in the route's LAYOUT — not in the page — so
// Next preserves them across a `?dan=` change. Switching days used to blank the
// whole screen (this strip included) into `loading.tsx`; now only the CONTENT
// below (`page.tsx`) swaps under the skeleton, while the wheel stays mounted and
// interactive. That is what makes day-switching feel instant, and it's why the
// date strip reads its own selected day from the URL (`useSearchParams`) rather
// than being handed a per-day `selected` prop the layout can't see.
//
// The strip's data (each day's mini-ring fill, the sign-up lower bound, the
// streak) is a "browse the calendar" fact, independent of WHICH day is open, so
// it belongs here and is fetched once per full load rather than on every hop.

/** Shifts a Belgrade calendar-day key by `n` days (noon-UTC is a robust
 * in-day instant; `Date.UTC` normalizes month/year overflow). */
function addDaysKey(key: string, n: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return toBelgradeCalendarDay(
    new Date(Date.UTC(year!, month! - 1, day! + n, 12))
  );
}

export default async function DanasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  // No session -> let the page render its own "sign in again" state; the header
  // has nothing to show without a user.
  if (!userId) return <>{children}</>;

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);

  // The strip's back-edge is a FIXED window (`today - STRIP_LOOKBACK_DAYS`),
  // not "all the way back to sign-up" -- so the mini-ring kcal read below has a
  // fixed range that does NOT depend on the profile, letting all four reads run
  // in ONE parallel batch instead of the old profile -> kcal waterfall.
  const lookbackStartKey = addDaysKey(todayKey, -STRIP_LOOKBACK_DAYS);

  const [profile, targetResult, streakDays, dayKcals] = await Promise.all([
    // Shared with `page.tsx` via React `cache()` -- one `profiles` read per
    // request instead of the layout and the page each firing their own.
    getDanasProfile(userId),
    supabase
      .from("targets")
      .select("daily_kcal")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Niz: the streak is a "now" fact (not per-viewed-day), so the pill can live
    // in the persistent header. A failed read degrades to no pill.
    getLoggedDayKeys(supabase, userId, now).catch(() => null),
    // Per-day summed kcal for the mini day-rings over the fixed lookback window.
    // A failed read degrades to empty rings.
    getLoggedDayKcals(
      supabase,
      userId,
      new Date(`${lookbackStartKey}T12:00:00.000Z`),
      now
    ),
  ]);

  const signupKey = profile?.created_at
    ? toBelgradeCalendarDay(new Date(profile.created_at))
    : undefined;
  // Always keep at least 5 days before today so today can sit centred even for
  // a brand-new user (those extra days render as faint pre-sign-up filler)...
  const fiveBefore = addDaysKey(todayKey, -5);
  const naturalStart =
    signupKey && signupKey < fiveBefore ? signupKey : fiveBefore;
  // ...but never reach further back than the fixed lookback cap.
  const startKey =
    naturalStart < lookbackStartKey ? lookbackStartKey : naturalStart;
  const endKey = addDaysKey(todayKey, STRIP_FUTURE_DAYS);
  const targetKcal = targetResult.data?.daily_kcal ?? 0;

  const days = buildDateStrip({
    now,
    // The client wheel derives its own selected day from the URL; this only
    // seeds the pre-hydration SSR markup, so "today" is the right default.
    selectedKey: todayKey,
    loggedDays: new Set(dayKcals.keys()),
    startKey,
    endKey,
    minKey: signupKey,
    dayKcals,
    targetKcal,
  });

  const streak: StreakSummary | null = streakDays
    ? computeStreak([...streakDays], todayKey)
    : null;

  // The onboarding ring hand-off (`fm_intro`) plays once, right after
  // onboarding. While it runs, fade/rise the header in with the dashboard
  // instead of letting it pop, matching `.home-body`'s reveal.
  const cookieStore = await cookies();
  const introActive = cookieStore.get("fm_intro") != null;

  return (
    <>
      <header
        className={
          "flex flex-col gap-5 px-6 pt-8" +
          (introActive ? " danas-header-intro" : "")
        }
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/fitmess-icon.png"
            alt=""
            width={36}
            height={36}
            aria-hidden="true"
            className="size-9 shrink-0 select-none"
          />
          <h1
            className="text-4xl tracking-tight text-foreground"
            style={{
              fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            }}
          >
            Fit<span className="fm-wordmark-accent">Mess</span>
          </h1>
          {streak ? (
            <StreakPill streak={streak} href="/dostignuca" className="ml-auto" />
          ) : null}
        </div>
        {days.length > 0 ? (
          // `DateStrip` reads `?dan=` via `useSearchParams`, so it needs a
          // Suspense boundary.
          <Suspense fallback={<div className="h-[86px]" />}>
            <DateStrip days={days} todayKey={todayKey} />
          </Suspense>
        ) : null}
      </header>
      {children}
    </>
  );
}
