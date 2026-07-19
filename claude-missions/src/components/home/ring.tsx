import { computeRemaining } from "@/lib/home/totals";

// F027 / AS-047 (remaining ring), AS-050 (neutral overshoot): the calorie
// gauge, centerpiece of `/danas`. Pure, presentational -- consumed/target
// come in as props, every number shown is computed by
// `src/lib/home/totals.ts` (never eyeballed here), matching the "money-math
// rule" the rest of this codebase follows.
//
// Layout (2026-07-19): a C-shaped gauge (open at the bottom) with the daily
// target ("Cilj") big in the centre, flanked by "Preostalo" (remaining) on
// the LEFT and "Potrošeno" (consumed) on the RIGHT. A `view` toggle (owned by
// `HomeScreen`) flips how the gauge FILLS -- draining as you eat in the
// "Preostalo" default, or filling up in "Potrošeno" -- while the three
// numbers stay put.
//
// Accessibility + overshoot (AS-047/AS-050): the accessible name always
// reports the remaining/overshoot number (the actionable one), and the gauge
// NEVER turns red/alarming -- it stays the teal accent, drains to empty when
// over budget, and the centre carries one short, calm, reassuring note.
// Zero-shame tone: overshooting is shown plainly, never punished visually.

export type RingView = "remaining" | "consumed";

const VIEW_BOX = 200;
const CENTER = VIEW_BOX / 2;
const RADIUS = 84;
const STROKE = 14;
// The gauge is a 270° arc with a 90° opening centred at the bottom: it runs
// from the bottom-left (225°) clockwise over the top to the bottom-right.
const START_ANGLE = 225;
const SWEEP_DEG = 270;

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

export function Ring({
  consumedKcal,
  targetKcal,
  view = "remaining",
}: {
  consumedKcal: number;
  targetKcal: number;
  view?: RingView;
}) {
  const { remainingKcal, isOver, overshootKcal } = computeRemaining(
    consumedKcal,
    targetKcal
  );

  const consumedRounded = Math.round(Math.max(0, consumedKcal));
  const targetRounded = Math.round(Math.max(0, targetKcal));
  const safeTarget = targetKcal > 0 ? targetKcal : 1;

  // The left "remaining" column also carries the accessible name + the
  // overshoot state (AS-050): "Preostalo" normally, "Prekoračeno" once over.
  const remainingLabel = isOver ? "Prekoračeno" : "Preostalo";
  const remainingValue = isOver ? overshootKcal : remainingKcal;

  // How full the gauge is, per the toggle: what's left (drains as you eat) vs.
  // what's been eaten (fills up).
  const fillFraction =
    view === "consumed"
      ? Math.max(0, consumedKcal) / safeTarget
      : Math.max(0, remainingKcal) / safeTarget;
  const percent = Math.min(100, Math.max(0, fillFraction * 100));
  // pathLength normalises the arc to 100 units so the dash maths is a plain
  // percentage; the fill is drawn from the start and the rest is dashed out.
  const dashOffset = 100 - percent;

  return (
    <div
      data-testid="home-ring"
      role="img"
      aria-label={`${remainingLabel} ${remainingValue} kcal`}
      className="mx-auto flex w-full max-w-sm items-center justify-between gap-1"
    >
      <SideColumn
        label={remainingLabel}
        value={remainingValue}
        valueTestId="home-ring-value"
        labelTestId="home-ring-label"
      />

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
          <path
            data-testid="home-ring-arc"
            d={ARC_PATH}
            fill="none"
            stroke="var(--gauge)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.2,0,0,1)" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-10 text-center">
          <span
            data-testid="home-ring-target"
            className="text-5xl font-bold tabular-nums text-foreground"
          >
            {targetRounded}
          </span>
          <span className="text-sm font-medium text-muted-foreground">Cilj</span>
          {isOver ? (
            <p
              data-testid="home-ring-overshoot-note"
              className="mt-1 max-w-[150px] text-[11px] leading-snug text-muted-foreground"
            >
              Jedan dan više ne menja ništa. Nastavi sutra kao i obično.
            </p>
          ) : null}
        </div>
      </div>

      <SideColumn
        label="Potrošeno"
        value={consumedRounded}
        valueTestId="home-ring-consumed"
      />
    </div>
  );
}

function SideColumn({
  label,
  value,
  valueTestId,
  labelTestId,
}: {
  label: string;
  value: number;
  valueTestId?: string;
  labelTestId?: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span
        data-testid={valueTestId}
        className="text-2xl font-semibold tabular-nums text-foreground"
      >
        {value}
      </span>
      <span
        data-testid={labelTestId}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </span>
    </div>
  );
}
