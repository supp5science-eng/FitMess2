"use client";

import { Flame } from "lucide-react";

import { ProgressRing } from "@/components/home/progress-ring";
import { FLAME_GRADIENT } from "@/components/streak/flame";
import { StreakDots } from "@/components/streak/streak-dots";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import {
  dayCountSr,
  dayNounSr,
  isMilestone,
  type StreakSummary,
} from "@/lib/streak/streak";

// Niz — the Analitika streak card: the weekly, reflective view of the same
// meal-logging streak the home card leads with. Richer than the home card
// (bigger ring, labeled 7-day dot row, personal record) but the exact same
// numbers, derived once by `computeStreak` — one streak, two screens, so they
// can never disagree. Matches the Analitika card language established by
// `WaterCard`/`analytics StepsCard`: a rounded-3xl `bg-card` panel, a badged
// header, a hero ring, a small series, one calm closing line.

export function StreakSummaryCard({ streak }: { streak: StreakSummary }) {
  const { t } = useT();
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
  const justReached = hasStreak && isMilestone(current);

  const hint = !hasStreak
    ? t("media.streakCard.hintStart")
    : justReached
      ? milestone
      : nextMilestone !== null
        ? t("media.streakCard.hintNext", {
            count: dayCountSr(daysToNext ?? 0),
            target: nextMilestone,
          })
        : t("media.streakCard.hintAllDone");

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
      <Header t={t} />

      {/* Hero: flame ring (filling toward the next milestone) + the count */}
      <div className="flex items-center gap-5">
        <ProgressRing
          fraction={progressToNext}
          size={108}
          stroke={9}
          trackClassName="text-[var(--streak-soft)]"
          gradient={FLAME_GRADIENT}
        >
          <Flame
            aria-hidden="true"
            strokeWidth={2.25}
            className={
              hasStreak
                ? "size-8 text-[var(--streak-accent)]"
                : "size-8 text-muted-foreground"
            }
            style={
              hasStreak
                ? { filter: "drop-shadow(0 0 8px var(--streak-glow))" }
                : undefined
            }
          />
        </ProgressRing>

        <div className="flex min-w-0 flex-col gap-0.5">
          {hasStreak ? (
            <span className="flex items-baseline gap-1.5 leading-none">
              <span
                data-testid="streak-summary-count"
                className="text-4xl font-bold tabular-nums text-foreground"
              >
                {current}
              </span>
              <span className="text-base font-medium text-muted-foreground">
                {t("media.streakCard.inARow", { noun: dayNounSr(current) })}
              </span>
            </span>
          ) : (
            <span
              data-testid="streak-summary-count"
              className="text-xl font-semibold text-foreground"
            >
              {t("media.streakCard.startYourStreak")}
            </span>
          )}

          <span
            className="mt-1 text-[13px] font-medium"
            style={{ color: hasStreak ? "var(--streak-accent)" : undefined }}
          >
            {hint}
          </span>

          <span className="mt-1 text-xs text-muted-foreground">
            {t("media.streakCard.longest", { count: dayCountSr(best) })}
          </span>
        </div>
      </div>

      {/* The last 7 days, labeled — the same window the rest of Analitika uses */}
      <StreakDots days={streak.recentDays} showLabels />

      <p className="text-center text-[11px] text-muted-foreground">
        {loggedToday
          ? t("media.streakCard.loggedToday")
          : t("media.streakCard.logToContinue")}
      </p>
    </section>
  );
}

function Header({ t }: { t: TFunction }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--streak-soft)" }}
      >
        <Flame
          className="size-4 text-[var(--streak-accent)]"
          strokeWidth={2.25}
        />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        {t("media.streakCard.title")}
      </h2>
      <span className="ml-auto text-xs text-muted-foreground">
        {t("media.streakCard.daysWithLog")}
      </span>
    </div>
  );
}