import { computeRingState, type RingLevel } from "@/lib/home/totals";
import { cn } from "@/lib/utils";

// F027 (redesign 2026-07-20): the calorie gauge, centerpiece of `/danas`.
// Pure, presentational -- consumed/target come in as props, every number is
// computed by `src/lib/home/totals.ts` (`computeRingState`), never eyeballed
// here (the codebase's "money-math rule").
//
// This replaces the earlier deliberately "zero-shame, never red" gauge with an
// at-a-glance traffic light, per the product owner's 2026-07-20 decision:
//
//   * The gauge ALWAYS fills with consumption (consumed / limit), regardless of
//     the toggle -- one consistent "how full is my day" metaphor.
//   * Its colour is a traffic light driven by how much budget is LEFT:
//     green (>50% left) -> yellow (15-50%) -> red (<15%, including over).
//   * The `view` toggle (owned by `HomeScreen`) swaps only the CENTRE headline
//     number between "Preostalo" (remaining) and "Potrošeno" (consumed) -- the
//     three numbers (Cilj / Potrošeno / Preostalo) are always distinct, fixing
//     the bug where the same number could read as both consumed and remaining.
//   * Over the limit: the gauge goes full red, a SECOND lap draws on top to
//     show how far over, and the remaining number goes NEGATIVE (e.g. -500) so
//     the user sees exactly how deep into the minus they are.

export type RingView = "remaining" | "consumed";

const VIEW_BOX = 200;
const CENTER = VIEW_BOX / 2;
const RADIUS = 84;
const STROKE = 14;
// The gauge is a 270° arc with a 90° opening centred at the bottom: it runs
// from the bottom-left (225°) clockwise over the top to the bottom-right.
const START_ANGLE = 225;
const SWEEP_DEG = 270;

/** Traffic-light stroke per budget level. */
const LEVEL_STROKE: Record<RingLevel, string> = {
  green: "#3fbf87",
  yellow: "#f2b23e",
  red: "#ef4444",
};
// The second lap (drawn on top of a full red first lap once over the limit) is
// a darker red, so the overshoot arc reads clearly against the full base.
const OVERSHOOT_STROKE = "#991b1b";

/** Point on the gauge circle at `angleDeg`, measured clockwise from 12 o'clock. */
function polar(angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.sin(a),
    y: CENTER - RADIUS * Math.cos(a),
  };
}

/** SVG path for the full 270° gauge track (start -> clockwise -> end). */
const start = polar(START_ANGLE);
const end = polar(START_ANGLE + SWEEP_DEG);
const ARC_PATH = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 1 1 ${end.x.toFixed(
  2
)} ${end.y.toFixed(2)}`;

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
          <path
            d={ARC_PATH}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* First lap: fills with consumption, coloured by the budget level. */}
          <path
            data-testid="home-ring-arc"
            data-level={state.level}
            d={ARC_PATH}
            fill="none"
            stroke={LEVEL_STROKE[state.level]}
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={fillDashOffset}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0,0,1)" }}
          />
          {/* Second lap: only over the limit -- draws on top of the full first
              lap to show how far past the budget the user has gone. */}
          {state.isOver ? (
            <path
              data-testid="home-ring-overshoot-arc"
              d={ARC_PATH}
              fill="none"
              stroke={OVERSHOOT_STROKE}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={overshootDashOffset}
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
