"use client";

import { Sparkles } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

// "Nedelja ti je u planu" -- the standing of the current week, at the top of
// /analitika (2026-08-01).
//
// It began life inside the home screen's plan card, which was the wrong home
// for it twice over. That card answers "what do I have to do TODAY", and a week
// that needs nothing done is precisely the case with no answer to give; and
// because the card sat inside the swipe pager, whose pages all share the
// tallest page's height, saying "you're fine" cost the Koraci/Voda and
// micronutrient pages real dead space. Here it is a disclaimer over the
// analytics it describes, which is what it always was.
//
// Deliberately small and quiet: it is good news, and good news that shouts
// gets tuned out by the third day.

function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function WeekOnTrackNote({
  roomKcal,
  daysLeft,
}: {
  /** kcal the rest of the week holds ABOVE plan pace. */
  roomKcal: number;
  /** Days left in the week including today (1..7). */
  daysLeft: number;
}) {
  const { t } = useT();

  return (
    <div
      data-testid="analytics-on-track"
      className="rounded-2xl border border-border bg-muted/40 px-4 py-3"
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        {t("analytics.onTrack.title")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("analytics.onTrack.room", {
          days: daysLeft,
          unit:
            daysLeft === 1
              ? t("analytics.onTrack.day")
              : t("analytics.onTrack.days"),
          kcal: formatNumber(roomKcal),
        })}
      </p>
    </div>
  );
}
