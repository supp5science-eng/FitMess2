"use client";

import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

/**
 * "Trening" — the home screen's entry point for logging deliberate activity,
 * and the day's running total once something is logged.
 *
 * A plain link, same shape as `GricButton`: the flow (`/dodaj/trening`) needs a
 * full screen for the activity grid, the duration and the day's list, so the
 * first tap lands straight in it rather than opening a sheet on the way.
 *
 * Deliberately COMPACT (one row, no ring, no 7-day strip). It shares a pager
 * page with the Koraci and Voda cards, and every pager page is as tall as the
 * tallest one -- a third full-height card here would add dead air to the
 * calorie and micronutrient pages, which is the exact regression the product
 * owner called out when the plan card lived inside the pager.
 *
 * The kcal shown is what the sessions COST, never spare allowance: this button
 * intentionally does not sit next to the calorie ring, and the screen it opens
 * says so in full (`trening.note.plan`).
 */
export function WorkoutButton({
  kcal = 0,
  minutes = 0,
}: {
  /** Net kcal burned in today's logged sessions (0 = nothing logged yet). */
  kcal?: number;
  /** Total minutes of today's logged sessions. */
  minutes?: number;
}) {
  const { t } = useT();
  const hasWorkouts = minutes > 0;

  return (
    <Link
      href="/dodaj/trening"
      data-testid="workout-open-button"
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 active:translate-y-px"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
          <Dumbbell className="size-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-semibold text-foreground">
            {t("trening.card.label")}
          </span>
          <span
            data-testid="workout-summary"
            className="text-xs text-muted-foreground"
          >
            {hasWorkouts
              ? t("trening.card.summary", { minutes, kcal })
              : t("trening.card.empty")}
          </span>
        </span>
      </span>
      <span className="flex size-7 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
        <Plus className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
