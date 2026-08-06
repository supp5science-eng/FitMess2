"use client";

import { useState } from "react";
import { CalendarClock, Footprints, X } from "lucide-react";

import { planLines, formatPlanNumber } from "@/components/home/plan-lines";
import { useT } from "@/components/i18n/locale-provider";
import { sheetPortal } from "@/components/ui/sheet-portal";
import type { AdaptivePlan } from "@/lib/home/adaptive";

/**
 * The quiet, every-day half of the plan's voice.
 *
 * `PlanIntro` is a MOMENT: once a day, only above the 5% threshold, gone in
 * five seconds. That left two holes it could not cover, and both are the
 * original complaint in miniature:
 *
 *   1. after the moment has played, the rest of the day has no explanation at
 *      all -- the ring just shows a number that isn't the usual one;
 *   2. below the threshold the moment never plays, so a smaller trim moves the
 *      number in complete silence.
 *
 * So: one line, always there while the plan is actually trimmed, saying how
 * many days it still applies to -- and a tap opens the full explanation. It is
 * deliberately ONE line high. The card this replaces was removed for being
 * furniture, and the lesson recorded then was that a reassuring message has to
 * be cheap: if "here is your situation" occupies half the screen, every other
 * element pays for it.
 *
 * Renders NOTHING when the plan hasn't moved. Silence stays the default.
 */
export function PlanNote({
  plan,
  dayKey,
}: {
  plan: AdaptivePlan;
  dayKey: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const lines = planLines(plan, dayKey, t);
  // Only when the NUMBER moved. An activity-only nudge (a target already at the
  // safety floor) has no "still X days" to report -- there is no changed number
  // for the line to be about.
  if (!lines.moved) return null;

  const days = plan.daysAfterToday;
  const unit =
    days === 1 ? t("home.adaptive.day") : t("home.adaptive.days");

  // "smanjen još 3 dana" while the week still has days to spread over; on the
  // last day there is no "still", only today.
  const label =
    days > 0
      ? t(
          lines.lifted
            ? "home.planNote.raisedDays"
            : "home.planNote.loweredDays",
          { days, unit }
        )
      : t(lines.lifted ? "home.planNote.raisedToday" : "home.planNote.loweredToday");

  return (
    <>
      <button
        type="button"
        data-testid="plan-note"
        onClick={() => setOpen(true)}
        className="home-body flex w-full items-center gap-2.5 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-left text-xs transition-colors active:bg-muted/70"
      >
        <CalendarClock
          className="size-4 shrink-0 text-primary"
          aria-hidden={true}
        />
        <span className="min-w-0 flex-1 text-foreground">{label}</span>
        <span className="shrink-0 font-medium text-primary">
          {t("home.planNote.why")}
        </span>
      </button>

      {open
        ? sheetPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-6"
              data-testid="plan-note-overlay"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="plan-note-title"
                data-testid="plan-note-sheet"
                onClick={(event) => event.stopPropagation()}
                className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl border border-border bg-card px-6 pb-8 pt-6 shadow-lg sm:rounded-3xl"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="size-8" aria-hidden="true" />
                  <h2
                    id="plan-note-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    {t("home.planIntro.title")}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("home.close")}
                    data-testid="plan-note-close"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>

                {/* Same order as the moment: the number first, the cause after
                    -- a screen about someone's day never opens with the
                    accusation. */}
                <p className="flex items-baseline justify-center gap-2">
                  <span
                    data-testid="plan-note-target"
                    className="text-4xl font-bold tabular-nums text-foreground"
                  >
                    {formatPlanNumber(plan.adaptiveDailyTarget)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    kcal ·{" "}
                    {t("home.planIntro.from", {
                      kcal: formatPlanNumber(plan.baseDailyTarget),
                    })}
                  </span>
                </p>

                <p
                  data-testid="plan-note-cause"
                  className="text-sm leading-relaxed text-foreground"
                >
                  {lines.cause}
                </p>

                {lines.walk ? (
                  <p
                    data-testid="plan-note-walk"
                    className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm text-foreground"
                  >
                    <Footprints
                      className="size-4 shrink-0 translate-y-0.5 text-primary"
                      aria-hidden={true}
                    />
                    <span>{lines.walk}</span>
                  </p>
                ) : null}

                {lines.forward ? (
                  <p className="text-xs text-muted-foreground">
                    {lines.forward}
                  </p>
                ) : null}

                {lines.spill ? (
                  <p
                    data-testid="plan-note-spill"
                    className="text-xs text-muted-foreground"
                  >
                    {lines.spill}
                  </p>
                ) : null}
              </div>
            </div>
          )
        : null}
    </>
  );
}
