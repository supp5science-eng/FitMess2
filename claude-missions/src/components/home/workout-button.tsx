"use client";

import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";

import {
  MiniWeekBars,
  type MiniWeekDay,
} from "@/components/home/mini-week-bars";
import { useT } from "@/components/i18n/locale-provider";

/**
 * "Trening" — the home screen's entry point for logging deliberate activity,
 * and the day's standing once something is logged.
 *
 * A plain link, same shape as `GricButton`/`WaterButton`: the flow
 * (`/dodaj/trening`) needs a full screen for the activity grid, the duration
 * and the day's list, so the first tap lands straight in it.
 *
 * ## Why the card has a body
 *
 * It shipped as a single row and left the movement page visibly empty
 * (2026-08-01). The pager's pages all share the tallest page's height, and the
 * fix for leftover space on this app is never to stretch the cards -- that is
 * the "everything is floating" look the product owner rejected twice. The
 * space carries CONTENT instead: what today cost, and how today compares to
 * the rest of your week.
 *
 * ## Why there is no ring and no goal
 *
 * Koraci and Voda fill a ring toward a daily goal. Training deliberately has
 * none: a workout quota is something you can fail, and this feature exists to
 * record what you did, not to grade it. The strip is therefore scaled against
 * the week's own busiest day (see `workout-week.ts`) -- it answers "is today
 * normal for me", never "did you hit the target".
 *
 * The kcal shown is what the sessions COST, never spare allowance -- the plan
 * already pays for training through the TDEE activity multiplier (see
 * `src/lib/workout/activities.ts`).
 */
export function WorkoutButton({
  kcal = 0,
  minutes = 0,
  restingKcal = null,
  week = [],
}: {
  /** Net kcal burned in the viewed day's logged sessions (0 = nothing yet). */
  kcal?: number;
  /** Total minutes of the viewed day's logged sessions. */
  minutes?: number;
  /** The user's BMR — the resting half of "potrošeno danas". Null on a profile
   * without height/birth year, in which case the total line is left out
   * rather than invented. */
  restingKcal?: number | null;
  /** The last 7 days as a share of the week's busiest day (server-derived by
   * `computeWorkoutWeek`). Empty => the strip is not drawn. */
  week?: MiniWeekDay[];
}) {
  const { t } = useT();
  const hasWorkouts = minutes > 0;
  const totalKcal = restingKcal !== null ? restingKcal + kcal : null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5">
        <Link
          href="/dodaj/trening"
          data-testid="workout-open-button"
          className="flex w-full items-center gap-3.5 text-left active:translate-y-px"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
            <Dumbbell className="size-5" aria-hidden="true" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-muted-foreground">
              {t("trening.card.label")}
            </span>
            <span
              data-testid="workout-summary"
              className="text-2xl font-bold leading-none text-foreground tabular-nums"
            >
              {hasWorkouts
                ? t("trening.card.kcal", { kcal })
                : t("trening.card.empty")}
            </span>
            {hasWorkouts ? (
              <span
                data-testid="workout-minutes"
                className="text-xs text-muted-foreground"
              >
                {t("trening.card.minutes", { minutes })}
              </span>
            ) : null}
          </span>

          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </Link>

        {/* The day's true expenditure, in one line. Resting comes first because
            it is the far bigger number -- seeing that the body spends most of
            its energy doing nothing is what keeps a 371 kcal session in
            proportion, and what stops the figure reading as food you earned. */}
        {hasWorkouts && totalKcal !== null ? (
          <p
            data-testid="workout-breakdown"
            className="text-xs text-muted-foreground"
          >
            {t("trening.card.breakdown", {
              resting: restingKcal!,
              training: kcal,
              total: totalKcal,
            })}
          </p>
        ) : null}

        <MiniWeekBars
          days={week}
          testId="workout-week-bars"
          barClassName="bg-orange-500"
          trackClassName="bg-orange-500/10"
          todayLabelClassName="text-orange-500"
        />
      </div>
    </div>
  );
}
