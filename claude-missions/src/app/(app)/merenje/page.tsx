import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { WeeklyResultCard } from "@/components/merenje/weekly-result-card";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { startOfBelgradeDay, toBelgradeCalendarDay } from "@/lib/dates";
import { DAY_ANSWER_COOKIE, parseDayAnswers } from "@/lib/home/day-trust";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadWeeklyReview } from "@/lib/weight/weekly-review";
import { getWeighInHistory } from "@/lib/weight/weigh-ins";

import { WeighInForm } from "./weigh-in-form";
import { WeighInHistory } from "./weigh-in-history";

/**
 * `/merenje` -- the weekly weigh-in and what it means.
 *
 * One screen, two halves: the reading goes in at the top, and what it says
 * about the plan comes back underneath. They are not separate steps because
 * they are not separate thoughts -- the point of stepping on the scale here is
 * to find out whether the plan still fits.
 *
 * Everything below the form is derived on the SERVER from stored data
 * (`loadWeeklyReview`), so the verdict is computed in exactly one place. The
 * form only writes a number and calls `router.refresh()`; it never hands the
 * card a trend of its own to disagree with.
 */
export default async function MerenjePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p role="alert" className="text-sm text-destructive">
          {t("profil.sessionExpired")}
        </p>
        <Link
          href="/prijava"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {t("analytics.action.signIn")}
        </Link>
      </main>
    );
  }

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);
  const cookieStore = await cookies();
  // The user's own answers about ambiguous days (`fm_dani`) outrank the
  // plausibility heuristic here exactly as they do on `/danas` -- a day they
  // have called complete counts toward the measured TDEE.
  const dayAnswers = parseDayAnswers(
    cookieStore.get(DAY_ANSWER_COOKIE)?.value ?? null
  );

  const [review, todayWeighIn, profile, history] = await Promise.all([
    loadWeeklyReview(supabase, userId, { dayAnswers, now }),
    supabase
      .from("weigh_ins")
      .select("weight_kg")
      .eq("user_id", userId)
      .eq("day", todayKey)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("weight_kg")
      .eq("user_id", userId)
      .maybeSingle(),
    // The list a wrong reading gets deleted from. A failed read costs the list
    // and nothing else -- the weigh-in itself must stay usable.
    getWeighInHistory(supabase, userId),
  ]);

  // Prefill: today's reading if it exists, otherwise the weight on file. Not an
  // empty box -- the user is confirming a number they just read off a display,
  // and starting from roughly the right one is a keystroke saved, not a nudge
  // (any value they type replaces it outright).
  const initialWeightKg =
    todayWeighIn.data?.weight_kg != null
      ? Number(todayWeighIn.data.weight_kg)
      : (profile.data?.weight_kg ?? null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/danas"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("merenje.backToToday")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("merenje.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("merenje.subtitle")}
        </p>
      </div>

      <WeighInForm todayKey={todayKey} initialWeightKg={initialWeightKg} />

      {/* The result appears once there is anything at all to report -- which
          includes "one weigh-in isn't a trend yet", because a user who has just
          recorded their first reading deserves to know what happens next rather
          than facing a blank space. */}
      {review.currentTarget ? (
        <WeeklyResultCard
          trend={review.trend}
          currentDailyKcal={review.currentTarget.dailyKcal}
          silenced={review.silenced}
        />
      ) : null}

      {/* Below the verdict on purpose: the point of this screen is the reading
          and what it means, and the history is the correction path you go
          looking for. Hidden entirely until there is something in it. */}
      {history.rows.length > 0 ? (
        <WeighInHistory
          rows={history.rows}
          todayKey={todayKey}
          // One second before today's Belgrade midnight lands in yesterday --
          // robust across DST and month boundaries.
          yesterdayKey={toBelgradeCalendarDay(
            new Date(startOfBelgradeDay(now).getTime() - 1000)
          )}
        />
      ) : null}

      <Link
        href="/profil/merenje"
        className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {t("merenje.settings.title")}
      </Link>
    </main>
  );
}
