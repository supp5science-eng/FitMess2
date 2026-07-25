"use client";

import { useEffect, useState } from "react";
import { Footprints, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { useCountUp } from "@/components/home/animated-number";
import type { AdaptivePlan } from "@/lib/home/adaptive";
import { cn } from "@/lib/utils";

import "./adaptive-plan-card.css";

// The home screen's explanation of WHY today's target isn't the usual number.
//
// Two states, one component:
//   - calm (default): the quiet card the user sees on every visit after the
//     first one that day.
//   - intro (`intro` prop): the once-a-day reveal. The number counts from the
//     regular target down/up to today's, the week bar fills, and the reasons
//     stagger in. Then it settles into the calm state and stays there.
//
// Why once a day and not every visit: an animation that replays on every
// navigation stops being a moment and becomes a stutter. The server decides
// (via the `fm_plan` cookie) and this component consumes it -- writing the
// cookie itself the first time it plays, so a refresh five seconds later is
// already calm.

/** How long the cookie suppresses a replay. Two days so a late-night visit
 * can't wrap around into "already seen" for tomorrow; the value is the day key
 * anyway, so correctness never depends on the expiry. */
const PLAN_COOKIE_MAX_AGE = 60 * 60 * 48;

export const PLAN_INTRO_COOKIE = "fm_plan";

/** Count-up length for the target number -- long enough to read as a change,
 * short enough that nobody waits for it. */
const NUMBER_TWEEN_MS = 900;

/** When the number starts moving, and when the whole reveal is over. */
const NUMBER_START_MS = 380;
const SETTLE_MS = 2100;

/** `10000` -> `"10.000"` (Serbian thousands separator). */
function formatSteps(steps: number): string {
  return String(steps).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AdaptivePlanCard({
  plan,
  intro = false,
  dayKey,
}: {
  plan: AdaptivePlan;
  /** First visit of the day AND the plan is adjusted -> play the reveal. */
  intro?: boolean;
  /** Belgrade day key stored in the cookie so the reveal is once PER DAY. */
  dayKey?: string;
}) {
  // `playing` drives the CSS; `revealed` flips the count-up's target.
  const [playing, setPlaying] = useState(intro);
  const [revealed, setRevealed] = useState(!intro);

  const shownTarget = useCountUp(
    revealed ? plan.adaptiveDailyTarget : plan.baseDailyTarget,
    revealed ? "adaptive" : "base",
    NUMBER_TWEEN_MS
  );

  useEffect(() => {
    if (!intro) return;

    // Burn the cookie immediately, not when the animation ends: if the user
    // navigates away mid-reveal, the moment still counts as spent. Replaying it
    // on the next tap would be worse than missing it once.
    if (dayKey) {
      try {
        document.cookie = `${PLAN_INTRO_COOKIE}=${dayKey}; path=/; max-age=${PLAN_COOKIE_MAX_AGE}; samesite=lax`;
      } catch {
        // A blocked cookie only means the reveal may replay -- never a crash.
      }
    }

    if (prefersReducedMotion()) {
      setPlaying(false);
      setRevealed(true);
      return;
    }

    const timers = [
      window.setTimeout(() => setRevealed(true), NUMBER_START_MS),
      window.setTimeout(() => setPlaying(false), SETTLE_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [intro, dayKey]);

  const lifted = plan.liftedKcal > 0;
  const Icon = lifted ? TrendingUp : TrendingDown;

  // Week bar geometry: how much of the weekly budget is already gone, and the
  // slice today is allowed to take out of what remains.
  const budget = Math.max(1, plan.weeklyBudget);
  const spentPct = Math.min(100, (plan.spentBeforeToday / budget) * 100);
  const todayPct = Math.min(100 - spentPct, (plan.adaptiveDailyTarget / budget) * 100);

  // Ordered entrance; each line declares its own beat.
  let beat = 0;
  const nextDelay = () => ({ "--apc-delay": `${(beat++ * 110) + 120}ms` }) as React.CSSProperties;

  return (
    <div
      data-testid="adaptive-note"
      className={cn(
        "apc home-body rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm",
        playing && "apc-intro"
      )}
    >
      {playing ? <span className="apc-sweep" aria-hidden="true" /> : null}

      <p
        className="apc-line flex items-center gap-1.5 font-semibold text-foreground"
        style={nextDelay()}
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Plan za danas je prilagođen
      </p>

      <p className="apc-line mt-1.5 flex items-baseline gap-2" style={nextDelay()}>
        <Icon className="size-4 shrink-0 self-center text-primary" aria-hidden="true" />
        <span
          data-testid="adaptive-note-target"
          className="text-2xl font-semibold tabular-nums text-foreground"
        >
          {Math.round(shownTarget)} kcal
        </span>
        <span className="text-xs text-muted-foreground">
          redovni {plan.baseDailyTarget}
        </span>
      </p>

      <div className="apc-line mt-2.5" style={nextDelay()}>
        <div
          className="apc-bar"
          style={
            {
              "--apc-fill": `${spentPct}%`,
              "--apc-today-left": `${spentPct}%`,
              "--apc-today-width": `${todayPct}%`,
            } as React.CSSProperties
          }
          role="presentation"
        >
          <div className="apc-bar-fill" />
          <div className="apc-bar-today" />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ove nedelje potrošeno {Math.round(plan.spentBeforeToday)} od{" "}
          {plan.weeklyBudget} kcal · još {plan.daysLeftIncludingToday}{" "}
          {plan.daysLeftIncludingToday === 1 ? "dan" : "dana"}
        </p>
      </div>

      <p className="apc-line mt-2 text-muted-foreground" style={nextDelay()}>
        {lifted
          ? "Ranije ove nedelje si uneo manje nego što plan traži, pa je današnji cilj podignut — da nedelja ispuni svoje."
          : "Zbog ranijeg prekoračenja, današnji cilj je snižen — da se nedelja vrati na prag."}
        {plan.carryInKcal > 0 ? (
          <>
            {" "}
            Uračunat je i prenos od {plan.carryInKcal} kcal iz prošle nedelje.
          </>
        ) : null}
      </p>

      {plan.trainingSuggestionKcal > 0 ? (
        <p
          data-testid="adaptive-note-training"
          className="apc-line mt-2 flex items-start gap-1.5 text-muted-foreground"
          style={nextDelay()}
        >
          <Footprints
            className="size-4 shrink-0 translate-y-0.5 text-primary"
            aria-hidden="true"
          />
          <span>
            Ostatak pokrij kretanjem:{" "}
            <span className="font-medium text-foreground">
              ~{plan.trainingSuggestionKcal} kcal
            </span>{" "}
            (≈ {plan.trainingWalkMinutes} min brzog hoda). Cilj koraka danas je{" "}
            <span
              data-testid="adaptive-note-steps"
              className="font-medium text-foreground"
            >
              {formatSteps(plan.adaptiveStepGoal)}
            </span>
            {plan.extraSteps > 0 ? ` (+${formatSteps(plan.extraSteps)})` : null}.
          </span>
        </p>
      ) : null}
    </div>
  );
}
