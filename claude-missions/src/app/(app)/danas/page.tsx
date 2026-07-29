import { cookies } from "next/headers";

import { HomeScreen } from "@/components/home/home-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  getBelgradeDayRange,
  getBelgradeWeekRange,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import {
  computeAdaptivePlan,
  computeCarryInFromLastWeek,
  type AdaptivePlan,
} from "@/lib/home/adaptive";
import { PLAN_INTRO_COOKIE } from "@/components/home/adaptive-plan-card";
import type { GoalType } from "@/lib/types/db";
import { buildDateStrip } from "@/lib/home/date-strip";
import { getLoggedDayKcals } from "@/lib/home/logged-days";
import { getTodayData } from "@/lib/home/today";
import { getLoggedDayKeys } from "@/lib/streak/read-streak";
import { computeStreak, type StreakSummary } from "@/lib/streak/streak";
import { getStepsForDay, getStepsWeek } from "@/lib/steps/steps";
import { resolveStepGoal } from "@/lib/steps/step-goal";
import { getCustomStepGoal } from "@/lib/steps/step-goal-read";
import { computeStepsWeek } from "@/lib/steps/steps-week";
import { getWaterMl, getWaterWeek } from "@/lib/water/water";
import { computeWaterWeek, waterGoalMl } from "@/lib/water/water-week";
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
  const [result, profileResult, customStepGoal] = await Promise.all([
    getTodayData(supabase, userId, range),
    supabase
      .from("profiles")
      // `activity_level` rides along (the column has always existed) because
      // it is what the automatic step goal is derived from; the newer
      // `daily_step_goal` override is read separately -- see
      // `src/lib/steps/step-goal-read.ts` for why.
      .select("created_at, sex, weight_kg, activity_level")
      .eq("user_id", userId)
      .maybeSingle(),
    getCustomStepGoal(supabase, userId),
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
  // Sign-up day = the earliest REAL (tappable) day; days before it are
  // "imaginary" filler. Always render at least 5 days before today so today can
  // sit centered even for a user who signed up today: start at the earlier of
  // sign-up and today-5.
  const signupKey = profileResult.data?.created_at
    ? toBelgradeCalendarDay(new Date(profileResult.data.created_at))
    : undefined;
  const fiveBefore = addDaysKey(todayKey, -5);
  const startKey =
    signupKey && signupKey < fiveBefore ? signupKey : fiveBefore;
  const endKey = addDaysKey(todayKey, 30);

  // Stage 2 of the read. These three are independent of one another -- they
  // only depend on stage 1's getTodayData + profiles -- so fetch them
  // concurrently rather than in a serial waterfall (which is what made the
  // authenticated render feel slow): one round-trip stage instead of three.
  //  - dayKcals: per-day summed kcal for the date strip's mini day-rings
  //    (past window start..today; the future is empty).
  //  - adaptivePlan ("Deo 2"): today's adaptive daily target -- only for the
  //    today view and only when a target exists. Redistributes any
  //    earlier-in-week overshoot across the rest of the week (carrying last
  //    week's debt in). A failed read falls back to no adjustment.
  //  - fm_intro cookie: the one-time onboarding "ring hand-off" (plan-reveal
  //    drops it just before navigating here, see `plan-reveal.tsx`); only ever
  //    plays for today.
  // The 7-day window the Koraci/Voda strips draw ends on the day being VIEWED
  // (not always today), so a past day's card shows that day in context.
  const selectedNoon = new Date(`${selectedKey}T12:00:00.000Z`);

  // Cilj koraka (2026-07-25): the user's own goal if they set one, otherwise
  // one derived from their activity level -- NOT a flat 10.000 for everybody.
  const stepGoal = resolveStepGoal(
    profileResult.data?.activity_level ?? null,
    customStepGoal
  ).goal;

  const [
    dayKcals,
    adaptivePlan,
    cookieStore,
    water,
    steps,
    stepsWeekRows,
    waterWeekRows,
    streakDays,
  ] = await Promise.all([
    getLoggedDayKcals(
      supabase,
      userId,
      new Date(`${startKey}T12:00:00.000Z`),
      now
    ),
    isToday && result.data.target
      ? getAdaptivePlan(
          supabase,
          userId,
          result.data.target.daily_kcal,
          profileResult.data?.sex ?? "male",
          result.data.target.goal,
          stepGoal,
          now
        )
      : Promise.resolve(null),
    cookies(),
    // Voda: the selected day's water total. A failed read degrades to 0 (the
    // button still works), never failing the day render.
    getWaterMl(supabase, userId, selectedKey),
    // Koraci: the selected day's step total. Same degrade-to-0 posture.
    getStepsForDay(supabase, userId, selectedKey),
    // The 7 days ending on the selected one, for the mini strips at the foot of
    // the Koraci/Voda cards. A failed read degrades to "no strip", never to a
    // failed day render.
    getStepsWeek(supabase, userId, selectedNoon),
    getWaterWeek(supabase, userId, selectedNoon),
    // Niz: the Belgrade days (in the trailing window) the user logged a meal
    // on, for the streak card. Only the today view shows the streak (it is a
    // "now" fact, not a per-day one), so a past-day view skips the read.
    isToday
      ? getLoggedDayKeys(supabase, userId, now)
      : Promise.resolve(null),
  ]);

  // Derive the streak purely from the logged-day keys (money-math rule). Null
  // when viewing a past day -> the home screen simply omits the card.
  const streak: StreakSummary | null = streakDays
    ? computeStreak([...streakDays], todayKey)
    : null;

  const waterGoal = waterGoalMl(profileResult.data?.weight_kg ?? null);
  // Map the two week models onto the strip's tiny shape (label + share of goal
  // + which column is the viewed day) -- the same derivation Analitika uses, so
  // the two screens can never disagree about a day.
  const stepsWeek = computeStepsWeek(
    stepsWeekRows.rows,
    selectedNoon,
    stepGoal
  ).days.map((day) => ({
    label: day.label,
    pct: day.pct,
    isToday: day.isToday,
  }));
  const waterWeek = computeWaterWeek(
    waterWeekRows.rows,
    selectedNoon,
    waterGoal
  ).days.map((day) => ({
    label: day.label,
    pct: waterGoal > 0 ? Math.min(1, day.ml / waterGoal) : 0,
    isToday: day.isToday,
  }));

  const days = buildDateStrip({
    now,
    selectedKey,
    loggedDays: new Set(dayKcals.keys()),
    startKey,
    endKey,
    minKey: signupKey,
    dayKcals,
    targetKcal: result.data.target?.daily_kcal ?? 0,
  });

  const intro = isToday && cookieStore.get("fm_intro") != null;
  // One-shot, set by the plan reveal alongside fm_intro: right after
  // onboarding completes, offer to install the PWA (the overlay itself
  // consumes the cookie + guards via localStorage, so it can never nag).
  const installPrompt = isToday && cookieStore.get("fm_install") != null;
  // "Plan za danas je prilagođen" plays ONCE per day. The cookie holds the day
  // key it last played for, so a new day re-arms it without any expiry games;
  // the card itself writes the cookie the moment it starts.
  const planIntro =
    isToday &&
    (adaptivePlan?.isAdjusted ?? false) &&
    cookieStore.get(PLAN_INTRO_COOKIE)?.value !== todayKey;

  return (
    // Keyed by the viewed day so switching days on the date strip REMOUNTS the
    // dashboard. `/danas` -> `/danas?dan=X` is the same route with only a
    // changed search param, so React would otherwise reuse the HomeScreen
    // instance and keep its day-scoped `useState` (logs, water, steps)
    // initialized from the FIRST day -- the ring/macros/meal list/water/steps
    // would stay on "today" even though a past day is selected. A per-day key
    // re-initializes all of it from this render's fresh server props. In-place
    // edits/deletes keep the same key (no navigation), so AS-043's
    // "update without a full reload" still holds.
    <HomeScreen
      key={selectedKey}
      initialLogs={result.data.logs}
      target={result.data.target}
      intro={intro}
      installPrompt={installPrompt}
      days={days}
      mealsHeading={isToday ? "Obroci danas" : `Obroci · ${shortDate(selectedKey)}`}
      adaptivePlan={adaptivePlan}
      planIntro={planIntro}
      dayKey={selectedKey}
      streak={streak}
      initialWaterMl={water.ml}
      initialSteps={steps.steps}
      stepsGoal={stepGoal}
      waterGoal={waterGoal}
      stepsWeek={stepsWeek}
      waterWeek={waterWeek}
      isToday={isToday}
    />
  );
}

/**
 * Fetches this week's + last week's logged kcal and derives today's adaptive
 * plan. Returns null on any read error so the dashboard degrades to the plain
 * daily target rather than failing.
 */
async function getAdaptivePlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  baseDailyTarget: number,
  sex: "male" | "female",
  goal: GoalType | null,
  baseStepGoal: number,
  now: Date
): Promise<AdaptivePlan | null> {
  const thisWeek = getBelgradeWeekRange(now);
  const lastWeek = getBelgradeWeekRange(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  );

  const [thisWeekResult, lastWeekResult] = await Promise.all([
    supabase
      .from("logs")
      .select("logged_at, kcal")
      .eq("user_id", userId)
      .gte("logged_at", thisWeek.startIso)
      .lt("logged_at", thisWeek.endIsoExclusive),
    supabase
      .from("logs")
      .select("logged_at, kcal")
      .eq("user_id", userId)
      .gte("logged_at", lastWeek.startIso)
      .lt("logged_at", lastWeek.endIsoExclusive),
  ]);

  if (thisWeekResult.error || lastWeekResult.error) {
    console.error(
      "[/danas adaptive] week logs read failed:",
      thisWeekResult.error?.message ?? lastWeekResult.error?.message
    );
    return null;
  }

  const carryInKcal = computeCarryInFromLastWeek(
    lastWeekResult.data ?? [],
    baseDailyTarget
  );

  return computeAdaptivePlan({
    weekLogs: thisWeekResult.data ?? [],
    baseDailyTarget,
    sex,
    goal,
    baseStepGoal,
    carryInKcal,
    now,
  });
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
