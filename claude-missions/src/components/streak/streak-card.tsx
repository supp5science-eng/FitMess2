import { Flame } from "lucide-react";

import { ProgressRing } from "@/components/home/progress-ring";
import { FLAME_GRADIENT } from "@/components/streak/flame";
import { StreakDots } from "@/components/streak/streak-dots";
import {
  dayCountSr,
  dayNounSr,
  isMilestone,
  type StreakSummary,
} from "@/lib/streak/streak";
import { cn } from "@/lib/utils";

// Niz — the home (`/danas`) streak card: how many days in a row the user has
// logged a meal, front and centre where they see it every day. Compact and
// horizontal so it sits above "Dnevni unos" without pushing the ring down: a
// flame ring (filling toward the next milestone) on the left, the count + a
// week-at-a-glance dot row on the right. Zero-shame throughout — a broken or
// not-yet-started streak reads as an invitation, never a failure.
//
// Purely presentational: every number arrives pre-derived from `computeStreak`
// (`src/lib/streak/streak.ts`), the same money-math rule the rest of the app
// follows. The `ProgressRing` is the very component the Koraci/Voda cards use,
// so the streak ring is visibly part of the same family, only warmer.

export function StreakCard({
  streak,
  className,
}: {
  streak: StreakSummary;
  className?: string;
}) {
  const {
    current,
    best,
    loggedToday,
    nextMilestone,
    daysToNext,
    progressToNext,
    milestone,
  } = streak;

  const hasStreak = current > 0;
  // A returning user who once had a real run gets their record acknowledged
  // rather than a blank "start" — the zero-shame way to say "come back".
  const hadRecord = !hasStreak && best >= 3;
  // A milestone is "just reached" only on the exact day the count lands on it;
  // between milestones the card shows the climb toward the next one instead of
  // a stale crown.
  const justReached = hasStreak && isMilestone(current);

  const hint = !hasStreak
    ? hadRecord
      ? `Rekord ti je ${dayCountSr(best)} — kreni ponovo 🔥`
      : "Uloguj obrok i započni niz 🔥"
    : justReached
      ? milestone
      : nextMilestone !== null
        ? `Još ${dayCountSr(daysToNext ?? 0)} do ${nextMilestone} 🔥`
        : "Neprekidan niz 🔥";

  return (
    <section
      aria-label={
        hasStreak
          ? `Niz: ${dayCountSr(current)} zaredom`
          : "Niz: još nije započet"
      }
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5",
        className
      )}
    >
      <ProgressRing
        fraction={progressToNext}
        size={64}
        stroke={6}
        trackClassName="text-orange-500/15"
        gradient={FLAME_GRADIENT}
      >
        <Flame
          aria-hidden="true"
          strokeWidth={2.25}
          className={cn(
            "size-6",
            hasStreak ? "text-orange-500" : "text-muted-foreground"
          )}
          style={
            hasStreak
              ? { filter: "drop-shadow(0 0 6px rgba(249,115,22,0.4))" }
              : undefined
          }
        />
      </ProgressRing>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-muted-foreground">
            Niz
          </span>
          {loggedToday ? (
            <span
              className="text-[0.7rem] font-semibold text-orange-500"
              aria-hidden="true"
            >
              · danas ✓
            </span>
          ) : null}
        </div>

        {hasStreak ? (
          <span className="flex items-baseline gap-1.5 leading-none">
            <span
              data-testid="streak-count"
              className="text-2xl font-bold tabular-nums text-foreground"
            >
              {current}
            </span>
            <span className="text-base font-medium text-muted-foreground">
              {dayNounSr(current)} zaredom
            </span>
          </span>
        ) : (
          <span
            data-testid="streak-count"
            className="text-lg font-semibold leading-none text-foreground"
          >
            {hadRecord ? "Vrati svoj niz" : "Započni svoj niz"}
          </span>
        )}

        <StreakDots days={streak.recentDays} className="mt-0.5" />

        <p className="text-xs font-medium text-muted-foreground">{hint}</p>
      </div>
    </section>
  );
}
