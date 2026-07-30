import { Suspense } from "react";
import { cookies } from "next/headers";

import { DateStrip } from "@/components/home/date-strip";
import { StreakPill } from "@/components/streak/streak-pill";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { buildDateStrip, type DayCell } from "@/lib/home/date-strip";
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

/**
 * The streak pill, resolved from an already-in-flight read. Awaiting the
 * promise HERE (inside a `Suspense` boundary) rather than in the layout body is
 * the whole point: the header's HTML flushes without it, and the pill is
 * streamed in when the 400-day log read lands.
 */
async function StreakPillSlot({
  streakPromise,
  todayKey,
}: {
  streakPromise: Promise<Set<string> | null>;
  todayKey: string;
}) {
  const streakDays = await streakPromise;
  const streak: StreakSummary | null = streakDays
    ? computeStreak([...streakDays], todayKey)
    : null;
  if (!streak) return null;
  return <StreakPill streak={streak} href="/dostignuca" className="ml-auto" />;
}

/**
 * Holds the wheel's place while its reads are in flight.
 *
 * The wheel now ALWAYS streams, so this fallback is on screen for a moment on
 * every load — which makes its height load-bearing: a few pixels off and the
 * whole dashboard jumps when the days land. Rather than hard-coding a measured
 * pixel value that silently rots the next time a cell's padding changes, this
 * mirrors `DateStrip`'s own box model with the SAME utility classes (scroller
 * `pt-2.5`, cell `px-1 py-2`, `gap-2`, `size-10` circle). Each placeholder cell
 * carries the weekday chip's `py-0.5`, matching the tallest real cell — today's
 * — which is what sets the row's height. So the two agree by construction.
 */
function DateStripFallback() {
  return (
    <div className="relative -mx-6" aria-hidden="true">
      <div className="flex overflow-hidden px-[calc(50%-2rem)] pt-2.5">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="flex w-16 shrink-0 flex-col items-center gap-2 px-1 py-2"
          >
            <span className="px-2 py-0.5 text-xs font-medium">&nbsp;</span>
            <span className="size-10 rounded-full bg-foreground/[0.04]" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The date wheel, resolved from already-in-flight reads. Same trick as
 * `StreakPillSlot`, and for the same reason: awaiting inside a `Suspense`
 * boundary lets the header's HTML flush WITHOUT it.
 */
async function DateStripSlot({
  stripPromise,
  todayKey,
}: {
  stripPromise: Promise<DayCell[]>;
  todayKey: string;
}) {
  const days = await stripPromise;
  if (days.length === 0) return null;
  return <DateStrip days={days} todayKey={todayKey} />;
}

/**
 * Everything the wheel needs: the profile (sign-up lower bound), the daily
 * target (mini-ring scale) and the per-day kcal sums (ring fills). One parallel
 * batch. Never rejects -- a failed read degrades to an empty strip rather than
 * taking down the header.
 */
async function buildStripDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
  todayKey: string,
  lookbackStartKey: string
): Promise<DayCell[]> {
  try {
    const [profile, targetResult, dayKcals] = await Promise.all([
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
      // Per-day summed kcal for the mini day-rings over the fixed lookback
      // window. A failed read degrades to empty rings.
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
    // Always keep at least 5 days before today so today can sit centred even
    // for a brand-new user (those extra days render as faint pre-sign-up
    // filler)...
    const fiveBefore = addDaysKey(todayKey, -5);
    const naturalStart =
      signupKey && signupKey < fiveBefore ? signupKey : fiveBefore;
    // ...but never reach further back than the fixed lookback cap.
    const startKey =
      naturalStart < lookbackStartKey ? lookbackStartKey : naturalStart;

    return buildDateStrip({
      now,
      // The client wheel derives its own selected day from the URL; this only
      // seeds the pre-hydration SSR markup, so "today" is the right default.
      selectedKey: todayKey,
      loggedDays: new Set(dayKcals.keys()),
      startKey,
      endKey: addDaysKey(todayKey, STRIP_FUTURE_DAYS),
      minKey: signupKey,
      dayKcals,
      targetKcal: targetResult.data?.daily_kcal ?? 0,
    });
  } catch (err) {
    console.error("[/danas header] date strip reads failed:", err);
    return [];
  }
}

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
  // not "all the way back to sign-up" -- so the mini-ring kcal read gets its
  // range without first knowing the profile, which is what lets `buildStripDays`
  // run its reads as ONE parallel batch instead of a profile -> kcal waterfall.
  const lookbackStartKey = addDaysKey(todayKey, -STRIP_LOOKBACK_DAYS);

  // Niz: the streak reads a 400-DAY window of logs (`STREAK_WINDOW_DAYS`) -- by
  // far the heaviest read on this screen. It is deliberately NOT awaited here:
  // the header sits OUTSIDE `loading.tsx`'s Suspense boundary, so anything this
  // layout awaits delays the whole document's first paint. Started now (so it
  // runs concurrently with the reads below) and handed to a Suspense-wrapped
  // slot, the pill streams in on its own while the wordmark and date wheel paint
  // immediately. A failed read degrades to no pill.
  const streakPromise = getLoggedDayKeys(supabase, userId, now).catch(
    () => null
  );

  // The wheel's own reads get the SAME treatment (2026-07-31). They used to be
  // awaited right here, which meant the whole document -- header, and with it
  // the page's `loading.tsx` skeleton -- waited on three Supabase round trips
  // before a single byte reached the phone. Started here so they still run
  // concurrently with the streak, but handed to a Suspense slot, so nothing
  // below blocks on them.
  //
  // What is left in this function's await path is now entirely LOCAL: building
  // the cookie-bound client, verifying the JWT (`getClaims`, no network) and
  // reading cookies. The shell and wordmark therefore flush immediately and the
  // skeleton appears while every read is still in flight.
  const stripPromise = buildStripDays(
    supabase,
    userId,
    now,
    todayKey,
    lookbackStartKey
  );

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
          {/* Streams in once the 400-day streak read lands, so it never holds
              up the wordmark or the date wheel. No fallback markup: an absent
              pill is already a valid state (a user with no streak), so a
              placeholder would only cause a layout shift when it resolves. */}
          <Suspense fallback={null}>
            <StreakPillSlot streakPromise={streakPromise} todayKey={todayKey} />
          </Suspense>
        </div>
        {/* Streams in with its reads. The fallback reserves the wheel's exact
            height, so the skeleton below never jumps when the days arrive.
            (`DateStrip` also reads `?dan=` via `useSearchParams`, which needs a
            Suspense boundary regardless.) */}
        <Suspense fallback={<DateStripFallback />}>
          <DateStripSlot stripPromise={stripPromise} todayKey={todayKey} />
        </Suspense>
      </header>
      {children}
    </>
  );
}
