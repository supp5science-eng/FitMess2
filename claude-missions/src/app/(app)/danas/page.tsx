import { cookies } from "next/headers";

import { HomeScreen } from "@/components/home/home-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getBelgradeDayRange, toBelgradeCalendarDay } from "@/lib/dates";
import { getAdaptivePlan } from "@/lib/home/adaptive-read";
import { DAY_ANSWER_COOKIE, parseDayAnswers } from "@/lib/home/day-trust";
import { bmr } from "@/lib/budget/engine";
import { getDanasProfile } from "@/lib/home/profile";
import { getTodayData } from "@/lib/home/today";
import { getT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locale";
import { resolveStepGoal } from "@/lib/steps/step-goal";
import { getCustomStepGoal } from "@/lib/steps/step-goal-read";
import { getWaterWeek } from "@/lib/water/water";
import { computeWaterWeek, waterGoalMl } from "@/lib/water/water-week";
import { createClient } from "@/lib/supabase/server";
import { weighInDueState } from "@/lib/weight/weigh-in-day";
import { getLastWeighInDay, getWeighInDay } from "@/lib/weight/weigh-ins";
import { computeWorkoutWeek } from "@/lib/workout/workout-week";
import { getWorkoutWeek } from "@/lib/workout/workouts";

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

const EN_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `"YYYY-MM-DD"` -> `"17. jul"` (sr) / `"Jul 17"` (en) for a past day's heading. */
function shortDate(key: string, locale: Locale): string {
  const [, month, day] = key.split("-").map(Number);
  if (locale === "en") return `${EN_MONTHS_SHORT[month! - 1]} ${day}`;
  return `${day}. ${SR_MONTHS_SHORT[month! - 1]}`;
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
  const { t, locale } = await getT();
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
  // instant).
  const range = getBelgradeDayRange(new Date(`${selectedKey}T12:00:00.000Z`));
  // The 7-day window the Koraci/Voda strips draw ends on the day being VIEWED
  // (not always today), so a past day's card shows that day in context.
  const selectedNoon = new Date(`${selectedKey}T12:00:00.000Z`);

  // ONE round-trip stage for everything that depends only on WHICH DAY is being
  // viewed. Voda/Koraci (and their 7-day strips) were previously in a second
  // stage that waited for this one to finish -- but they only ever needed
  // `selectedKey`/`selectedNoon`, never `getTodayData`'s result, so that barrier
  // was pure dead wall-clock: the calorie ring sat waiting on the water read and
  // vice versa. Only the adaptive plan genuinely depends on a result here (it
  // needs the target row), so it is the ONLY thing left in a second stage.
  const [
    result,
    profile,
    customStepGoal,
    cookieStore,
    waterWeekRows,
    lastWeighInDay,
    weighInDay,
    workoutWeekRows,
  ] = await Promise.all([
    getTodayData(supabase, userId, range),
    // Shared with `layout.tsx` via React `cache()` -- the layout already reads
    // this same row for the date strip, so the two now share one round trip
    // instead of each firing its own `profiles` read. `activity_level` drives
    // the automatic step goal; the newer `daily_step_goal` override is read
    // separately -- see `src/lib/steps/step-goal-read.ts` for why.
    getDanasProfile(userId),
    getCustomStepGoal(supabase, userId),
    // The one-time onboarding "ring hand-off" cookies (`fm_intro`/`fm_install`,
    // dropped by `plan-reveal.tsx` just before navigating here) -- local, no
    // round trip, but it belongs in the same stage rather than gating one.
    cookies(),
    // The 7 days ending on the selected one, for the mini strip at the foot of
    // the Voda card. A failed read degrades to "no strip", never to a failed
    // day render.
    //
    // It ALSO supplies the selected day's own water total (see below). This
    // screen used to additionally fire `getWaterMl` for exactly the day that is
    // already the LAST row of this window -- an extra Supabase round trip per
    // day switch, fetching a number we had in hand. Same degrade-to-0 posture
    // as the dedicated day read had: a failed window read yields no rows, so
    // the day reads 0 and the card still works.
    //
    // The matching `getStepsWeek` read was dropped on 2026-08-01 with the
    // Koraci card -- one fewer round trip on the dashboard's hot path. Steps
    // still power Analitika, which does its own read.
    getWaterWeek(supabase, userId, selectedNoon),
    // Nedeljno merenje: two point lookups on indexed columns, both needing
    // nothing but `userId`, so they cost no wall-clock here -- they finish
    // inside the slowest read above. Each is deliberately its OWN query rather
    // than a column bolted onto an existing select: `weighin_day` lives in a
    // migration (0024) that an environment may not have applied yet, and a
    // missing column must cost the banner, not the dashboard.
    getLastWeighInDay(supabase, userId),
    getWeighInDay(supabase, userId),
    // Trening: the 7 days ending on the viewed one -- the card's strip AND
    // (as its last row) that day's own totals, so this is one round trip
    // rather than two. Same degrade-to-zero posture as the reads above: a
    // table this environment hasn't migrated yet costs the card its numbers,
    // never the dashboard.
    getWorkoutWeek(supabase, userId, selectedNoon),
  ]);

  // The viewed day is the LAST day of each window above, so its own total comes
  // straight out of the rows. Absent (nothing logged that day) reads as 0.
  const waterMl =
    waterWeekRows.rows.find((row) => row.day === selectedKey)?.ml ?? 0;

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

  // Cilj koraka (2026-07-25): the user's own goal if they set one, otherwise
  // one derived from their activity level -- NOT a flat 10.000 for everybody.
  const stepGoal = resolveStepGoal(
    profile?.activity_level ?? null,
    customStepGoal
  ).goal;

  // The ONLY genuinely dependent read: the adaptive plan needs the target row
  // that the stage above fetched. Today's adaptive daily target -- only for the
  // today view and only when a target exists. Redistributes any earlier-in-week
  // overshoot across the rest of the week (carrying last week's debt in). A
  // failed read falls back to no adjustment.
  // The date strip itself (mini-ring fills, sign-up bound, streak) is built in
  // the persistent `layout.tsx`, so this page no longer reads any of that.
  // The line below which a day's log reads as "not fully entered" rather than
  // as a real day (see `lib/home/day-trust.ts`). Computed here because only
  // this page has the profile; a row missing height/birth year yields null and
  // the trust pass falls back to the sex floor.
  const userBmr =
    profile?.sex && profile.weight_kg && profile.height_cm && profile.birth_year
      ? bmr(
          profile.sex,
          profile.weight_kg,
          profile.height_cm,
          now.getUTCFullYear() - profile.birth_year
        )
      : null;
  const dayAnswers = parseDayAnswers(
    cookieStore.get(DAY_ANSWER_COOKIE)?.value ?? null
  );

  const adaptivePlan =
    isToday && result.data.target
      ? await getAdaptivePlan(supabase, userId, {
          baseDailyTarget: result.data.target.daily_kcal,
          sex: profile?.sex ?? "male",
          goal: result.data.target.goal,
          baseStepGoal: stepGoal,
          bmrKcal: userBmr,
          dayAnswers,
          weightKg: profile?.weight_kg ?? null,
          now,
        })
      : null;

  // Nedeljno merenje: is the app still waiting on this week's reading? `null`
  // means "no, nothing to ask" -- the banner renders only for a real wait.
  const weighIn = weighInDueState({
    todayKey,
    weighInDay,
    lastWeighInDay,
  });
  const weighInDaysWaiting = weighIn.due ? weighIn.daysWaiting : null;

  const waterGoal = waterGoalMl(profile?.weight_kg ?? null);
  // Map the week model onto the strip's tiny shape (label + share of goal +
  // which column is the viewed day) -- the same derivation Analitika uses, so
  // the two screens can never disagree about a day.
  // Trening: the same window, scaled against the week's own busiest day (there
  // is no training goal on purpose -- see `workout-week.ts`).
  const workoutWeekModel = computeWorkoutWeek(
    workoutWeekRows.rows,
    selectedNoon
  );
  const workoutWeek = workoutWeekModel.days.map((day) => ({
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

  const intro = isToday && cookieStore.get("fm_intro") != null;
  // One-shot, set by the plan reveal alongside fm_intro: right after
  // onboarding completes, offer to install the PWA (the overlay itself
  // consumes the cookie + guards via localStorage, so it can never nag).
  const installPrompt = isToday && cookieStore.get("fm_install") != null;
  return (
    // Keyed by the viewed day so switching days on the date strip REMOUNTS the
    // dashboard. `/danas` -> `/danas?dan=X` is the same route with only a
    // changed search param, so React would otherwise reuse the HomeScreen
    // instance and keep its day-scoped `useState` (logs, water, steps)
    // initialized from the FIRST day -- the ring/macros/meal list/water/steps
    // would stay on "today" even though a past day is selected. A per-day key
    // re-initializes all of it from this render's fresh server props. In-place
    // edits/deletes keep the same key (no navigation), so AS-043's
    // "update without a full reload" still holds. The header + date wheel live
    // in `layout.tsx` (persistent), so they are NOT keyed and never remount.
    <HomeScreen
      key={selectedKey}
      initialLogs={result.data.logs}
      target={result.data.target}
      intro={intro}
      installPrompt={installPrompt}
      mealsHeading={
        isToday
          ? t("home.mealsToday")
          : t("home.mealsOn", { date: shortDate(selectedKey, locale) })
      }
      adaptivePlan={adaptivePlan}
      dayKey={selectedKey}
      initialWaterMl={waterMl}
      waterGoal={waterGoal}
      waterWeek={waterWeek}
      isToday={isToday}
      weighInDaysWaiting={weighInDaysWaiting}
      workoutKcal={workoutWeekModel.todayKcal}
      workoutMinutes={workoutWeekModel.todayMinutes}
      workoutWeek={workoutWeek}
      restingKcal={userBmr}
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
