"use client";

import { useState, type Ref } from "react";

import { AnimatedNumber } from "@/components/home/animated-number";
import { MacroBars } from "@/components/home/macro-bars";
import { useT } from "@/components/i18n/locale-provider";
import type { RingView } from "@/components/home/ring";
import { computeRingState } from "@/lib/home/totals";
import { cn } from "@/lib/utils";

// "Slivanje" (2026-07-29): the `/danas` centrepiece. The calorie ring lives in
// its OWN glass "oblak" (cloud), and the three macros below feed COLOURED
// THREADS that climb and pour into the ring, with a droplet where each meets
// it. Two floating tiers joined by living threads -- one cohesive confluence.
//
// Why one SVG for ring AND threads: the threads must land exactly on the ring's
// lower arc. Drawing both in a single viewBox that scales with the column width
// keeps them pixel-aligned at every phone size (a separate, fixed-size ring
// would drift from width-relative threads). The numbers + toggle are HTML
// overlays positioned as percentages of that same box; the macro tiles
// (`MacroBars`) sit directly beneath, so the threads' feet meet the tile tops.
//
// Money-math rule: every number still comes from `computeRingState` -- nothing
// is eyeballed here. The ring/number test ids and the `role="img"` accessible
// name match the old `Ring` so the home-screen tests keep passing.
//
// The arc now RESPONDS to the toggle (product decision 2026-07-29): under
// budget it shows the SELECTED metric -- consumed fills the ring, remaining
// drains it -- so "Potrošeno" is a small arc and "Preostalo" a large one. Over
// budget both views show the full lap + the red overshoot lap (remaining is 0),
// with the toggle swapping only the centre number.

const VIEW_BOX_W = 352;
const VIEW_BOX_H = 300;
const CX = 176;
const CY = 140;
const RADIUS = 76;
const STROKE = 15;

// The over-budget second lap (drawn on top of a full first lap), a deep red so
// the overshoot reads clearly against the brand gradient -- same as the ring.
const OVERSHOOT_STROKE = "#991b1b";

// Each macro's thread: a cubic from the tile top (y=300, the confluence's
// bottom edge = the tiles' top) up to a point on the ring's lower arc, plus the
// droplet coordinates there. Colours are the themed `--macro-*` tokens, so the
// thread matches its tile.
const THREADS = [
  {
    key: "protein",
    color: "var(--macro-protein)",
    d: "M55,300 C55,250 118,226 132,202",
    dropX: 132,
    dropY: 202,
    delay: "0s",
  },
  {
    key: "fat",
    color: "var(--macro-fat)",
    d: "M176,300 C176,264 176,246 176,216",
    dropX: 176,
    dropY: 216,
    delay: "0.35s",
  },
  {
    key: "carbs",
    color: "var(--macro-carbs)",
    d: "M297,300 C297,250 234,226 220,202",
    dropX: 220,
    dropY: 202,
    delay: "0.7s",
  },
] as const;

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
  // Forwarded onto the ring cloud so the onboarding ghost hand-off can measure
  // where to dock (the same `home-ring-slot` the old ring used).
  ringRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useT();
  const [view, setView] = useState<RingView>("remaining");
  const state = computeRingState(consumedKcal, targetKcal);

  // Arc responds to the toggle (under budget): consumed FILLS, remaining DRAINS.
  // Over budget it's a full lap either way (remaining is 0) + the overshoot lap.
  const remainingArcFraction =
    Math.max(0, state.remainingKcal) / (state.targetKcal || 1);
  const arcFraction =
    view === "consumed" || state.isOver
      ? state.fillFraction
      : remainingArcFraction;
  const fillDashOffset = 100 - arcFraction * 100;
  const overshootDashOffset = 100 - state.overshootFraction * 100;

  const isRemaining = view === "remaining";
  // Centre = the selected metric; the other one sits on the right; Cilj left.
  const centre = isRemaining
    ? {
        value: state.remainingKcal,
        label: t("ring.remaining"),
        testId: "home-ring-value",
        labelTestId: "home-ring-label",
        danger: state.isOver,
      }
    : {
        value: state.consumedKcal,
        label: t("ring.consumed"),
        testId: "home-ring-consumed",
        labelTestId: undefined,
        danger: false,
      };
  const right = isRemaining
    ? {
        value: state.consumedKcal,
        label: t("ring.consumed"),
        testId: "home-ring-consumed",
        labelTestId: undefined,
        danger: false,
      }
    : {
        value: state.remainingKcal,
        label: t("ring.remaining"),
        testId: "home-ring-value",
        labelTestId: "home-ring-label",
        danger: state.isOver,
      };

  const ariaLabel = state.isOver
    ? `Prekoračeno ${state.overshootKcal} kcal`
    : `Preostalo ${state.remainingKcal} kcal`;

  return (
    <div className="flex flex-col gap-1">
      {/* Ring cloud area: the glass backdrop, the ring+threads SVG, the number
          overlays, and the toggle -- all in one measured slot. */}
      <div ref={ringRef} className="home-ring-slot relative">
        {/* Glass "oblak" behind the ring (decorative). Sized to hug the ring;
            the threads cross its lower edge on their way in. */}
        <div
          aria-hidden="true"
          className="fm-cloud pointer-events-none absolute inset-x-0 top-0 h-[74%] rounded-[2rem]"
        />

        {/* One SVG so the threads land exactly on the ring's lower arc. */}
        <div
          data-testid="home-ring"
          role="img"
          aria-label={ariaLabel}
          className="relative z-10"
        >
          <svg
            viewBox={`0 0 ${VIEW_BOX_W} ${VIEW_BOX_H}`}
            className="block w-full"
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
                <feGaussianBlur stdDeviation="3.4" />
              </filter>
            </defs>

            {/* Threads: a soft glow underlay + the marching-dash flow on top. */}
            {THREADS.map((thread) => (
              <g key={thread.key}>
                <path
                  d={thread.d}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={7}
                  opacity={0.22}
                  filter="url(#fm-conf-glow)"
                  style={{ stroke: thread.color }}
                />
                <path
                  d={thread.d}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={3.4}
                  className="fm-thread-flow"
                  style={{ stroke: thread.color, animationDelay: thread.delay }}
                />
              </g>
            ))}

            {/* Droplets where each thread pours into the ring. */}
            {THREADS.map((thread) => (
              <circle
                key={thread.key}
                cx={thread.dropX}
                cy={thread.dropY}
                r={3.6}
                className="fm-droplet"
                style={{ fill: thread.color, animationDelay: thread.delay }}
              />
            ))}

            {/* Faint full-circle track. */}
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              style={{ stroke: "var(--gauge-track)" }}
            />
            {/* Soft glow under the arc. */}
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
              opacity={0.3}
              filter="url(#fm-conf-glow)"
              className="fm-arc"
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
              className="fm-arc"
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
                className="fm-arc"
              />
            ) : null}
          </svg>

          {/* Cilj (left) */}
          <div className="absolute left-[11.4%] top-[46.5%] -translate-x-1/2 -translate-y-1/2 text-center">
            <div
              data-testid="home-ring-target"
              className="font-semibold leading-none tabular-nums text-foreground"
              style={{ fontSize: "clamp(1rem, 5vw, 1.4rem)" }}
            >
              {state.targetKcal}
            </div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
              {t("ring.target")}
            </div>
          </div>

          {/* Centre = the selected metric */}
          <div className="absolute left-1/2 top-[46.5%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center px-4 text-center">
            <AnimatedNumber
              value={centre.value}
              animateKey={view}
              data-testid={centre.testId}
              className={cn(
                "font-bold leading-none tabular-nums",
                centre.danger ? "text-destructive" : "text-foreground"
              )}
              style={{ fontSize: "clamp(2.1rem, 11.5vw, 3rem)" }}
            />
            <span
              data-testid={centre.labelTestId}
              className="mt-1 text-sm font-medium text-muted-foreground"
            >
              {centre.label}
            </span>
            {state.isOver ? (
              <span
                data-testid="home-ring-overshoot-note"
                className="mt-0.5 text-[11px] font-semibold text-destructive"
              >
                preko cilja
              </span>
            ) : null}
          </div>

          {/* Alt metric (right) */}
          <div className="absolute left-[88.6%] top-[46.5%] -translate-x-1/2 -translate-y-1/2 text-center">
            <div
              data-testid={right.testId}
              className={cn(
                "font-semibold leading-none tabular-nums",
                right.danger ? "text-destructive" : "text-foreground"
              )}
              style={{ fontSize: "clamp(1rem, 5vw, 1.4rem)" }}
            >
              {right.value}
            </div>
            <div
              data-testid={right.labelTestId}
              className="mt-0.5 text-xs font-medium text-muted-foreground"
            >
              {right.label}
            </div>
          </div>
        </div>

        {/* View toggle -- OUTSIDE the role="img" ring so it stays a real,
            reachable control, floated at the top of the cloud. */}
        <div className="absolute left-1/2 top-[3.5%] z-20 -translate-x-1/2">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Macro tiles -- the sources the threads flow from. `home-body` staggers
          them in during the onboarding intro (the ring fades in on its own). */}
      <div className="home-body">
        <MacroBars
          consumed={consumedMacros}
          target={targetMacros}
          view={view}
        />
      </div>
    </div>
  );
}

/**
 * The "Potrošeno | Preostalo" segmented toggle that drives the ring arc, the
 * centre number, and the macro tiles. Two real buttons in a pill; the selected
 * one is a high-contrast fill. "Preostalo" is the default.
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
      className="inline-flex items-center gap-1 rounded-full bg-muted/80 p-1 backdrop-blur-sm"
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
              "min-h-9 rounded-full px-4 text-[13px] font-semibold transition-colors",
              selected
                ? "bg-foreground text-background shadow-sm"
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
