import { computeRingState, type RingLevel } from "@/lib/home/totals";
import { cn } from "@/lib/utils";

// F027 (redesign 2026-07-22): the calorie gauge, centerpiece of `/danas`.
// Pure, presentational -- consumed/target come in as props, every number is
// computed by `src/lib/home/totals.ts` (`computeRingState`), never eyeballed
// here (the codebase's "money-math rule").
//
// Visual redesign per the product owner's 2026-07-22 decision: an
// Apple-Fitness-style FULL ring (360°, thick rounded stroke, fills clockwise
// from 12 o'clock) instead of the earlier 270° gauge, coloured with the
// brand-logo gradient (the pear's teal→mint→blue sheen) so it reads as
// "FitMess" in BOTH themes -- the traffic-light stroke washed out on the
// white theme. The traffic-light LEVEL is still computed and exposed as
// `data-level` (tests + potential future accents key off it); what changed is
// only the stroke itself.
//
//   * The ring ALWAYS fills with consumption (consumed / limit), regardless of
//     the toggle -- one consistent "how full is my day" metaphor.
//   * The `view` toggle (owned by `HomeScreen`) swaps only the CENTRE headline
//     number between "Preostalo" (remaining) and "Potrošeno" (consumed) -- the
//     three numbers (Cilj / Potrošeno / Preostalo) are always distinct.
//   * Over the limit: the ring closes fully, a SECOND lap in the deep
//     "overshoot" red draws on top to show how far over, and the remaining
//     number goes NEGATIVE (e.g. -500).

export type RingView = "remaining" | "consumed";

// The brand-logo ring gradient (sampled from the pear logo's teal→mint→blue
// iridescence; the middle stop is the canonical `--brand` teal #17d1a8).
// Shared with the date strip's mini day-rings so both read as one system.
export const RING_GRADIENT_STOPS = ["#3ee6bf", "#17d1a8", "#2a9fd1"] as const;
// Faint track behind the fill -- a transparent tint of the brand teal, which
// stays visible on white and on the near-black dark theme alike.
export const RING_TRACK_STROKE =
  "color-mix(in srgb, #17d1a8 18%, transparent)";

const VIEW_BOX = 200;
const CENTER = VIEW_BOX / 2;
const RADIUS = 82;
const STROKE = 18;

// The second lap (drawn on top of the closed first lap once over the limit) is
// a dark red, so the overshoot arc reads clearly against the brand gradient.
const OVERSHOOT_STROKE = "#991b1b";

interface MetricSpec {
  value: number;
  label: string;
  valueTestId?: string;
  labelTestId?: string;
  danger?: boolean;
}

export function Ring({
  consumedKcal,
  targetKcal,
  view = "remaining",
}: {
  consumedKcal: number;
  targetKcal: number;
  view?: RingView;
}) {
  const state = computeRingState(consumedKcal, targetKcal);
  // Kept for `data-level` (tests / future accents); the stroke itself is
  // always the brand gradient now.
  const level: RingLevel = state.level;

  // The three numbers, each with a stable semantic test id regardless of where
  // (centre vs. side) it ends up for the current toggle -- so the remaining
  // number is always `home-ring-value`, consumed always `home-ring-consumed`,
  // target always `home-ring-target`.
  const targetSpec: MetricSpec = {
    value: state.targetKcal,
    label: "Cilj",
    valueTestId: "home-ring-target",
  };
  const consumedSpec: MetricSpec = {
    value: state.consumedKcal,
    label: "Potrošeno",
    valueTestId: "home-ring-consumed",
  };
  const remainingSpec: MetricSpec = {
    value: state.remainingKcal,
    label: "Preostalo",
    valueTestId: "home-ring-value",
    labelTestId: "home-ring-label",
    danger: state.isOver,
  };

  const isRemainingView = view === "remaining";
  const centerSpec = isRemainingView ? remainingSpec : consumedSpec;
  const rightSpec = isRemainingView ? consumedSpec : remainingSpec;

  const fillDashOffset = 100 - state.fillFraction * 100;
  const overshootDashOffset = 100 - state.overshootFraction * 100;

  // The accessible name always reports the actionable number: how much is left,
  // or how far over.
  const ariaLabel = state.isOver
    ? `Prekoračeno ${state.overshootKcal} kcal`
    : `Preostalo ${state.remainingKcal} kcal`;

  return (
    <div
      data-testid="home-ring"
      role="img"
      aria-label={ariaLabel}
      className="mx-auto flex w-full max-w-sm items-center justify-between gap-1"
    >
      <SideColumn spec={targetSpec} />

      <div className="relative shrink-0" style={{ width: 196, height: 196 }}>
        <svg
          viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="fm-ring-gradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor={RING_GRADIENT_STOPS[0]} />
              <stop offset="55%" stopColor={RING_GRADIENT_STOPS[1]} />
              <stop offset="100%" stopColor={RING_GRADIENT_STOPS[2]} />
            </linearGradient>
          </defs>

          {/* Faint full-circle track in the brand tint. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={RING_TRACK_STROKE}
            strokeWidth={STROKE}
          />
          {/* First lap: fills clockwise from 12 o'clock with consumption,
              stroked with the brand-logo gradient. */}
          <circle
            data-testid="home-ring-arc"
            data-level={level}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="url(#fm-ring-gradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={fillDashOffset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0,0,1)" }}
          />
          {/* Second lap: only over the limit -- draws on top of the closed
              first lap to show how far past the budget the user has gone. */}
          {state.isOver ? (
            <circle
              data-testid="home-ring-overshoot-arc"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={OVERSHOOT_STROKE}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={overshootDashOffset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              style={{
                transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0,0,1)",
              }}
            />
          ) : null}
        </svg>

        {/* Centre = the toggle-selected metric (remaining or consumed). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-11 text-center">
          <span
            data-testid={centerSpec.valueTestId}
            className={cn(
              "font-bold tabular-nums",
              state.isOver ? "text-4xl" : "text-5xl",
              centerSpec.danger ? "text-destructive" : "text-foreground"
            )}
          >
            {centerSpec.value}
          </span>
          <span
            data-testid={centerSpec.labelTestId}
            className={cn(
              "font-medium text-muted-foreground",
              state.isOver ? "text-xs" : "text-sm"
            )}
          >
            {centerSpec.label}
          </span>
          {state.isOver ? (
            <p
              data-testid="home-ring-overshoot-note"
              className="mt-0.5 text-[11px] font-semibold text-destructive"
            >
              preko cilja
            </p>
          ) : null}
        </div>
      </div>

      <SideColumn spec={rightSpec} />
    </div>
  );
}

function SideColumn({ spec }: { spec: MetricSpec }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span
        data-testid={spec.valueTestId}
        className={cn(
          "text-2xl font-semibold tabular-nums",
          spec.danger ? "text-destructive" : "text-foreground"
        )}
      >
        {spec.value}
      </span>
      <span
        data-testid={spec.labelTestId}
        className="text-xs font-medium text-muted-foreground"
      >
        {spec.label}
      </span>
    </div>
  );
}
