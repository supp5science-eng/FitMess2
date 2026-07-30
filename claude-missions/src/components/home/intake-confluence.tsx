"use client";

import { useState, type Ref } from "react";

import { AnimatedNumber } from "@/components/home/animated-number";
import { MacroBars } from "@/components/home/macro-bars";
import { useT } from "@/components/i18n/locale-provider";
import type { RingView } from "@/components/home/ring";
import { computeRingState } from "@/lib/home/totals";
import { cn } from "@/lib/utils";

// The `/danas` centrepiece (redesign 2026-07-30, "Pravac B"). The calorie ring
// lives in its OWN floating glass card (`fm-cloud`) together with the toggle and
// the Cilj / Potrošeno / Preostalo row; the three macro tiles float as their own
// raised cards directly beneath it (`MacroBars`). Two floating tiers, cleanly
// separated -- no threads, no droplets dangling into empty space (the old
// "Slivanje" confluence read as broken wires hanging off the card).
//
// The ring is a single centred SVG. Its number + toggle are HTML overlays on the
// same box, so they scale with the card at every phone width. Motion is kept
// deliberately subtle: the arc eases when the toggle resizes it (`.fm-arc`) and a
// soft halo breathes behind it (`.fm-ring-glow`); both collapse under
// reduced-motion.
//
// Money-math rule: every number still comes from `computeRingState` -- nothing is
// eyeballed here. The ring/number test ids, the `role="img"` accessible name, and
// the `home-ring-slot` hook (the onboarding ghost hand-off docks on it) are all
// preserved so the existing tests and the intro animation keep working.
//
// The arc RESPONDS to the toggle: under budget it shows the SELECTED metric --
// consumed fills the ring, remaining drains it. Over budget both views show the
// full lap + the red overshoot lap (remaining is 0), with the toggle swapping
// only the centre number.

// Square viewBox: a pure, centred ring (no thread space below it any more).
const VIEW_BOX = 200;
const CX = 100;
const CY = 100;
const RADIUS = 84;
const STROKE = 16;

// The over-budget second lap (drawn on top of a full first lap), a deep red so
// the overshoot reads clearly against the brand gradient.
const OVERSHOOT_STROKE = "#991b1b";

/** One number in the row under the dial. `key` doubles as the match against
 * the current view, which is what marks a column as the promoted one. */
interface Stat {
  key: RingView | "target";
  value: number;
  label: string;
  testId: string;
  labelTestId?: string;
  danger?: boolean;
}

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
  // Forwarded onto the ring card so the onboarding ghost hand-off can measure
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

  // The stat row under the dial, in a reading order that never changes: the
  // fixed budget first, then the day's two moving numbers. Each test id is tied
  // to its metric for good (remaining is always `home-ring-value`, consumed
  // always `home-ring-consumed`, target always `home-ring-target`), so a view
  // switch moves no id anywhere -- it only promotes one of them into the dial.
  const stats: Stat[] = [
    {
      key: "target",
      value: state.targetKcal,
      label: t("ring.target"),
      testId: "home-ring-target",
    },
    {
      key: "consumed",
      value: state.consumedKcal,
      label: t("ring.consumed"),
      testId: "home-ring-consumed",
    },
    {
      key: "remaining",
      value: state.remainingKcal,
      label: t("ring.remaining"),
      testId: "home-ring-value",
      labelTestId: "home-ring-label",
      danger: state.isOver,
    },
  ];
  // Centre = whichever of the two moving numbers the toggle has selected.
  const centre =
    view === "remaining"
      ? { value: state.remainingKcal, danger: state.isOver }
      : { value: state.consumedKcal, danger: false };

  const ariaLabel = state.isOver
    ? `Prekoračeno ${state.overshootKcal} kcal`
    : `Preostalo ${state.remainingKcal} kcal`;

  return (
    <div className="flex flex-col gap-2.5">
      {/* The ring's own floating glass card: the toggle, the ring+number, and
          the three-stat row all live on one raised `fm-cloud` surface -- a
          single object that hovers over the aurora ground. */}
      <div
        ref={ringRef}
        className="home-ring-slot fm-cloud relative flex flex-col gap-3.5 rounded-[1.75rem] px-5 pb-5 pt-4"
      >
        {/* View toggle, parked in the card's top-right corner. It stays OUTSIDE
            the role="img" ring so it remains a real, reachable control. */}
        <div className="flex justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>

        {/* The dial: a single centred SVG with the number overlaid on top. */}
        <div
          data-testid="home-ring"
          role="img"
          aria-label={ariaLabel}
          className="relative mx-auto w-full max-w-[220px]"
        >
          <svg
            viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
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

            {/* Faint full-circle track. */}
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              style={{ stroke: "var(--gauge-track)" }}
            />
            {/* Soft halo under the arc -- breathes gently (subtle motion that
                replaced the old thread flow). */}
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

          {/* Centre = the selected metric, and nothing else. No label under it:
              the toggle above and the highlighted column below both name it, and
              a bare number is what makes the dial read as one object. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <AnimatedNumber
              value={centre.value}
              animateKey={view}
              className={cn(
                "font-bold leading-none tabular-nums",
                centre.danger ? "text-destructive" : "text-foreground"
              )}
              style={{ fontSize: "clamp(2.1rem, 11.5vw, 3rem)" }}
            />
            {state.isOver ? (
              <span
                data-testid="home-ring-overshoot-note"
                className="mt-1.5 text-[11px] font-semibold text-destructive"
              >
                preko cilja
              </span>
            ) : null}
          </div>
        </div>

        {/* The three numbers, equal thirds with hairline rules between them, on
            the SAME three-column grid as the macro tiles below. A top hairline
            separates them from the ring. All three are always present and the
            same size -- the one the toggle promoted into the dial is only DARKER
            -- so nothing jumps when you switch views. */}
        <div className="grid grid-cols-3 border-t border-border/60 pt-3.5">
          {stats.map((stat, i) => (
            <StatColumn
              key={stat.key}
              stat={stat}
              active={stat.key === view}
              divided={i > 0}
            />
          ))}
        </div>
      </div>

      {/* Macro tiles -- three floating cards of their own. `home-body` staggers
          them in during the onboarding intro (the ring card fades in on its own
          via `home-ring-slot`). */}
      <div className="home-body">
        <MacroBars consumed={consumedMacros} target={targetMacros} view={view} />
      </div>
    </div>
  );
}

/**
 * One third of the stat row. `active` = the number currently shown inside the
 * dial; it is only DARKER, never bigger, so the row stays a calm ruler and the
 * dial keeps the emphasis.
 */
function StatColumn({
  stat,
  active,
  divided,
}: {
  stat: Stat;
  active: boolean;
  divided: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 px-1",
        divided && "border-l border-border/60"
      )}
    >
      <span
        data-testid={stat.testId}
        className={cn(
          "text-lg font-semibold leading-none tabular-nums tracking-tight",
          stat.danger
            ? "text-destructive"
            : active
              ? "text-foreground"
              : "text-foreground/70"
        )}
      >
        {stat.value}
      </span>
      <span
        data-testid={stat.labelTestId}
        className={cn(
          "text-xs",
          active
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground"
        )}
      >
        {stat.label}
      </span>
    </div>
  );
}

/**
 * The "Potrošeno | Preostalo" segmented toggle that drives the ring arc, the
 * centre number, and the macro tiles. Two real buttons in a pill; "Preostalo"
 * is the default. A raised light thumb on a muted track (iOS-style), small
 * enough to sit quietly in the card's corner.
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
              "min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors",
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
