"use client";

import { useState, type Ref } from "react";

import { AnimatedNumber } from "@/components/home/animated-number";
import { MacroBars } from "@/components/home/macro-bars";
import { useT } from "@/components/i18n/locale-provider";
import type { RingView } from "@/components/home/ring";
import { computeRingState } from "@/lib/home/totals";
import { cn } from "@/lib/utils";

// The `/danas` centrepiece (redesign 2026-07-30, "Cal AI" layout). The calorie
// card reads left-to-right: the big number (the metric the toggle selected) with
// its tappable "Preostalo / Potrošeno" label, and a progress ring with a flame
// icon on the right. Below it float the three macro cards (`MacroBars`), each its
// own ring + icon. Two floating tiers, no threads.
//
// Money-math rule: every number still comes from `computeRingState` -- nothing is
// eyeballed here. The ring/number test ids, the `role="img"` accessible name, and
// the `home-ring-slot` hook (the onboarding ghost hand-off docks on it) are all
// preserved.
//
// The arc RESPONDS to the toggle: it shows the SELECTED metric -- consumed
// fills the ring, remaining drains it. Over budget nothing is left to drain, so
// the "Preostalo" arc sits empty and the red overshoot lap carries the story
// (in "Potrošeno" the blue lap is full underneath it, as before).

// Ring geometry (a compact dial that holds the flame, not the number).
const CX = 50;
const CY = 50;
const RADIUS = 42;
const STROKE = 8;

// The over-budget second lap (drawn on top of a full first lap), a deep red so
// the overshoot reads clearly against the brand gradient.
const OVERSHOOT_STROKE = "#991b1b";

export function IntakeConfluence({
  consumedKcal,
  targetKcal,
  consumedMacros,
  targetMacros,
  ringRef,
}: {
  consumedKcal: number;
  targetKcal: number;
  consumedMacros: { protein: number; carbs: number; fat: number };
  targetMacros: { proteinG: number; carbsG: number; fatG: number };
  // Forwarded onto the calorie card so the onboarding ghost hand-off can measure
  // where to dock (the same `home-ring-slot` the old ring used).
  ringRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useT();
  const [view, setView] = useState<RingView>("remaining");
  const state = computeRingState(consumedKcal, targetKcal);

  // The arc draws the metric the toggle has selected, so the picture and the
  // big number always agree:
  //   * "Potrošeno" FILLS as the day is eaten (0 -> full).
  //   * "Preostalo" DRAINS as the day is eaten (full -> 0) -- at 1000 of 3000
  //     kcal it stands at 2/3, the same two thirds the number reports.
  // It used to be pinned to a full circle in "Preostalo", so the ring looked
  // exactly the same whether 100 or 2900 of a 3000 kcal day was gone; the
  // toggle moved the number while the picture stayed put and said "full".
  //
  // Over budget there is nothing left to draw: `remainingFraction` is 0, so the
  // blue lap empties and the red overshoot lap below carries the story.
  const arcFraction =
    view === "remaining" ? state.remainingFraction : state.fillFraction;
  const fillDashOffset = 100 - arcFraction * 100;
  const overshootDashOffset = 100 - state.overshootFraction * 100;

  // Big number = whichever of the two moving metrics the toggle has selected.
  const centre =
    view === "remaining"
      ? { value: state.remainingKcal, danger: state.isOver }
      : { value: state.consumedKcal, danger: false };
  const viewLabel =
    view === "remaining" ? t("ring.remaining") : t("ring.consumed");

  const ariaLabel = state.isOver
    ? `Prekoračeno ${state.overshootKcal} kcal`
    : `Preostalo ${state.remainingKcal} kcal`;

  return (
    <div className="flex flex-col gap-2.5">
      {/* The calorie card: number + toggle on the left, the flame ring on the
          right, on one raised `fm-cloud` glass surface. */}
      <div
        ref={ringRef}
        className="home-ring-slot fm-cloud relative rounded-[2rem] px-6 py-8"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: the big number + the Potrošeno/Preostalo switch. The column
              grows to fill the space between the card edge and the ring so the
              switch can sit centred in that gap. */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <AnimatedNumber
              value={centre.value}
              animateKey={view}
              data-testid="home-ring-value"
              className={cn(
                "font-extrabold leading-none tabular-nums",
                centre.danger ? "text-destructive" : "text-foreground"
              )}
              style={{ fontSize: "clamp(2.75rem, 14vw, 3.75rem)" }}
            />

            {/* The segmented switch flips what the number shows (Potrošeno vs
                Preostalo). Centred in the left gap -- exactly between the card
                edge and the ring. */}
            <div className="flex justify-center">
              <ViewToggle view={view} onChange={setView} />
            </div>

            {state.isOver ? (
              <span
                data-testid="home-ring-overshoot-note"
                className="text-xs font-semibold text-destructive"
              >
                preko cilja
              </span>
            ) : null}

            {/* The current metric + Cilj + Potrošeno stay in the DOM
                (accessible + tested) without crowding the card; the ring and
                the switch encode them visually. */}
            <span className="sr-only" data-testid="home-ring-label">
              {viewLabel}
            </span>
            <span className="sr-only" data-testid="home-ring-target">
              {state.targetKcal}
            </span>
            <span className="sr-only" data-testid="home-ring-consumed">
              {state.consumedKcal}
            </span>
          </div>

          {/* Right: the flame ring. The arc responds to the toggle; the flame
              sits in its centre. */}
          <div
            data-testid="home-ring"
            role="img"
            aria-label={ariaLabel}
            className="relative size-32 shrink-0"
          >
            <svg
              viewBox="0 0 100 100"
              className="block size-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="fm-conf-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--gauge-grad-1)" }} />
                  <stop offset="55%" style={{ stopColor: "var(--gauge-grad-2)" }} />
                  <stop offset="100%" style={{ stopColor: "var(--gauge-grad-3)" }} />
                </linearGradient>
                <filter
                  id="fm-conf-glow"
                  x="-60%"
                  y="-60%"
                  width="220%"
                  height="220%"
                >
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>

              {/* Faint full-circle track. */}
              <circle
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                style={{ stroke: "var(--gauge-track)" }}
              />
              {/* Soft halo under the arc -- breathes gently. */}
              <circle
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke="url(#fm-conf-grad)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={fillDashOffset}
                transform={`rotate(-90 ${CX} ${CY})`}
                filter="url(#fm-conf-glow)"
                className="fm-arc fm-ring-glow"
              />
              {/* The arc itself -- responds to the toggle. */}
              <circle
                data-testid="home-ring-arc"
                data-level={state.level}
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke="url(#fm-conf-grad)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={fillDashOffset}
                transform={`rotate(-90 ${CX} ${CY})`}
                className="fm-arc fm-arc-in"
              />
              {state.isOver ? (
                <circle
                  data-testid="home-ring-overshoot-arc"
                  cx={CX}
                  cy={CY}
                  r={RADIUS}
                  fill="none"
                  stroke={OVERSHOOT_STROKE}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={overshootDashOffset}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  className="fm-arc fm-arc-in"
                />
              ) : null}
            </svg>

            <div className="absolute inset-0 grid place-items-center">
              {/* The FitMess pear mark, centred in the ring. Decorative -- the
                  ring's own aria-label already names the value. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/fitmess-icon.png"
                alt=""
                aria-hidden="true"
                className="size-20 select-none object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Macro cards -- three floating rings of their own. `home-body` staggers
          them in during the onboarding intro (the calorie card fades in via
          `home-ring-slot`). */}
      <div className="home-body">
        <MacroBars consumed={consumedMacros} target={targetMacros} view={view} />
      </div>
    </div>
  );
}

/**
 * The "Potrošeno | Preostalo" segmented switch that drives the big number (and,
 * indirectly, which grams the macro cards show). Two real buttons in a pill; the
 * selected one is a raised light thumb on a muted track (iOS-style).
 */
function ViewToggle({
  view,
  onChange,
}: {
  view: RingView;
  onChange: (next: RingView) => void;
}) {
  const { t } = useT();
  const options: { value: RingView; label: string }[] = [
    { value: "consumed", label: t("home.view.consumed") },
    { value: "remaining", label: t("home.view.remaining") },
  ];

  return (
    <div
      role="group"
      aria-label={t("home.view.aria")}
      data-testid="home-view-toggle"
      className="inline-flex w-fit items-center gap-1 rounded-full bg-muted/80 p-1 backdrop-blur-sm"
    >
      {options.map(({ value, label }) => {
        const selected = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={cn(
              "min-h-8 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
