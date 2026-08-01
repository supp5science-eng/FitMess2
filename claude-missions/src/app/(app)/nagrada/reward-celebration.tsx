"use client";

import { Trophy, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { MEALS_FOR_FULL_DAY, streakMilestone } from "@/lib/awards/streak";
import { cn } from "@/lib/utils";

// Nagrada: the celebration itself.
//
// The animation is CSS (see the `fm-award-*` keyframes in `globals.css`) rather
// than a JS timeline — one staggered cascade of `transform`/`opacity`, which is
// what keeps it genuinely smooth on a mid-range phone instead of smooth on a
// laptop and janky where it actually runs.
//
// The ONE thing JavaScript owns is the streak counting up, because a number
// ticking to its value is not something CSS can express. It runs on
// `requestAnimationFrame` with an ease-out curve, is cancelled on unmount, and
// — importantly — is skipped entirely under `prefers-reduced-motion`, where it
// simply renders the final number.

/** Where each spark flies. Fixed rather than random so the celebration looks
 * the same every time: a reward that reshuffles itself feels like a glitch. */
const SPARKS: { x: number; y: number; scale: number; delay: number; hue: string }[] = [
  { x: -96, y: -74, scale: 0.9, delay: 0.30, hue: "bg-primary" },
  { x: 88, y: -86, scale: 1.1, delay: 0.34, hue: "bg-amber-400" },
  { x: -122, y: 6, scale: 0.8, delay: 0.38, hue: "bg-amber-300" },
  { x: 118, y: -12, scale: 1.0, delay: 0.32, hue: "bg-primary" },
  { x: -70, y: 84, scale: 1.0, delay: 0.42, hue: "bg-amber-400" },
  { x: 76, y: 92, scale: 0.85, delay: 0.36, hue: "bg-primary" },
  { x: -34, y: -116, scale: 1.05, delay: 0.44, hue: "bg-amber-300" },
  { x: 28, y: 118, scale: 0.75, delay: 0.40, hue: "bg-amber-400" },
  { x: -140, y: -40, scale: 0.7, delay: 0.48, hue: "bg-primary" },
  { x: 138, y: 48, scale: 0.7, delay: 0.46, hue: "bg-amber-300" },
  { x: 8, y: -140, scale: 0.65, delay: 0.52, hue: "bg-amber-400" },
  { x: -14, y: 142, scale: 0.6, delay: 0.50, hue: "bg-primary" },
];

/** Circumference of the r=48 ring below, so the dash animation covers it
 * exactly. Hard-coded to match the `fm-award-ring` keyframe's offset. */
const RING_LENGTH = 302;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Counts from 0 up to `target` over `duration`, easing out.
 *
 * Starts at the final value and returns it unchanged when the user has asked
 * for reduced motion, or when there is nothing to count to.
 */
function useCountUp(target: number, duration = 900): number {
  // Starts at 0 and is DERIVED back to `target` for the no-animation cases
  // below, rather than being set to it from inside the effect: a setState in an
  // effect body costs a second render pass on every mount, and it would land on
  // the users who asked for reduced motion -- exactly the ones who should get
  // the cheapest path, not the most expensive one.
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);
  const skip = target <= 0 || prefersReducedMotion();

  useEffect(() => {
    if (skip) return;

    // The count-up waits for the badge to land, so the eye has somewhere to be
    // first; before that it shows 0 rather than the answer.
    const start = performance.now() + 450;

    const tick = (nowMs: number) => {
      const elapsed = nowMs - start;

      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic: fast to begin with, gently arriving — the same shape as
      // the CSS curves around it.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, skip]);

  return skip ? target : value;
}

export function RewardCelebration({
  earned,
  streak,
  loggedMeals,
}: {
  earned: boolean;
  streak: number;
  loggedMeals: number;
}) {
  const { t } = useT();
  const shownStreak = useCountUp(earned ? streak : 0);

  if (!earned) return <NotYet loggedMeals={loggedMeals} t={t} />;

  const milestone = streakMilestone(streak);

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-12 text-center">
      {/* Everything decorative is aria-hidden: a screen reader should get the
          words, not a description of the confetti. */}
      <div className="relative flex size-64 shrink-0 items-center justify-center">
        <span
          aria-hidden="true"
          className="fm-award-glow absolute size-56 rounded-full bg-primary/25 blur-3xl"
        />

        {/* Sparks. Twelve absolutely-positioned dots sharing one keyframe,
            each handed its own vector through CSS variables. */}
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "fm-award-spark absolute size-2 rounded-full",
              spark.hue
            )}
            style={
              {
                "--fm-spark-x": `${spark.x}px`,
                "--fm-spark-y": `${spark.y}px`,
                "--fm-spark-scale": spark.scale,
                "--fm-spark-delay": `${spark.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* The ring drawing itself closed around the badge. Rotated -90° so it
            starts at twelve o'clock instead of three. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 112 112"
          className="absolute size-40 -rotate-90"
        >
          <circle
            cx="56"
            cy="56"
            r="48"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="fm-award-ring stroke-primary"
            strokeDasharray={RING_LENGTH}
          />
        </svg>

        <span className="fm-award-badge relative flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30">
          <Trophy className="size-14" aria-hidden="true" />
        </span>
      </div>

      <div
        className="fm-award-rise flex flex-col gap-2"
        style={{ "--fm-rise-delay": "0.5s" } as React.CSSProperties}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("media.reward.title")}
        </h1>
        <p className="text-base text-muted-foreground">
          {t("media.reward.subtitle")}
        </p>
      </div>

      <div
        className="fm-award-rise flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-8 py-5"
        style={{ "--fm-rise-delay": "0.66s" } as React.CSSProperties}
      >
        <span
          className="text-5xl font-bold tabular-nums text-foreground"
          // The live number changes every frame; announcing each tick would be
          // noise, so the accessible name is the final value, stated once.
          aria-label={t("media.reward.streakAria", {
            streak,
            noun: streak === 1 ? t("media.reward.dayOne") : t("media.reward.dayMany"),
          })}
        >
          <span aria-hidden="true">{shownStreak}</span>
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {streak === 1
            ? t("media.reward.dayInARowOne")
            : t("media.reward.dayInARowMany")}
        </span>
        {milestone ? (
          <span className="mt-1 text-sm font-medium text-primary">
            {milestone}
          </span>
        ) : null}
      </div>

      <div
        className="fm-award-rise flex w-full flex-col gap-2"
        style={{ "--fm-rise-delay": "0.82s" } as React.CSSProperties}
      >
        <Link
          href="/danas"
          className={cn(buttonVariants(), "h-12 w-full text-base")}
        >
          {t("media.reward.continue")}
        </Link>
        <Link
          href="/analitika"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
        >
          {t("media.reward.viewAnalytics")}
        </Link>
      </div>
    </main>
  );
}

/** Opened before the day is earned — usually a notification tapped the next
 * morning. Says what is missing, and gets out of the way. */
function NotYet({
  loggedMeals,
  t,
}: {
  loggedMeals: number;
  t: TFunction;
}) {
  const left = Math.max(0, MEALS_FOR_FULL_DAY - loggedMeals);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UtensilsCrossed className="size-11" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("media.reward.notYetTitle")}
        </h1>
        <p className="text-base text-muted-foreground">
          {left === 1
            ? t("media.reward.oneMealLeft")
            : t("media.reward.mealsLeft", { count: left })}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Link
          href="/dodaj"
          className={cn(buttonVariants(), "h-12 w-full text-base")}
        >
          {t("media.reward.logMeal")}
        </Link>
        <Link
          href="/danas"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
        >
          {t("media.reward.backToToday")}
        </Link>
      </div>
    </main>
  );
}
