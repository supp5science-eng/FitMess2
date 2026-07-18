import { computeRemaining } from "@/lib/home/totals";

// F027 / AS-047 (remaining ring), AS-050 (neutral overshoot): the big
// circular progress ring, Cal AI-inspired centerpiece of `/danas`. Pure,
// presentational -- consumed/target come in as props, every number shown is
// computed by `src/lib/home/totals.ts` (never eyeballed here), matching the
// "money-math rule" posture the rest of this codebase follows.
//
// Overshoot state (AS-050): the ring NEVER switches to a red/alarming
// color -- it stays the app's single green accent (`var(--primary)`) at a
// full 100% fill, and the center copy swaps from "Preostalo" to
// "Prekoračeno" plus one short, calm, reassuring sentence. Per the
// clarified "zero-shame tone" / "one bad day is small" philosophy, this is
// a deliberate design choice: overshooting is shown plainly (the number is
// real and visible), never punished visually.

const RING_SIZE = 232;
const RING_RADIUS = 98;
const RING_STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function Ring({
  consumedKcal,
  targetKcal,
}: {
  consumedKcal: number;
  targetKcal: number;
}) {
  const { remainingKcal, isOver, overshootKcal } = computeRemaining(
    consumedKcal,
    targetKcal
  );

  const safeTarget = targetKcal > 0 ? targetKcal : 1;
  const rawPercent = (Math.max(0, consumedKcal) / safeTarget) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));
  const dashOffset = CIRCUMFERENCE * (1 - percent / 100);

  const centerLabel = isOver ? "Prekoračeno" : "Preostalo";
  const centerValue = isOver ? overshootKcal : remainingKcal;

  return (
    <div
      data-testid="home-ring"
      role="img"
      aria-label={`${centerLabel} ${centerValue} kcal`}
      className="relative mx-auto flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={RING_STROKE}
        />
        <circle
          data-testid="home-ring-arc"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className="absolute flex flex-col items-center justify-center gap-0.5 px-11 text-center">
        <span
          data-testid="home-ring-label"
          className="text-sm font-medium text-muted-foreground"
        >
          {centerLabel}
        </span>
        <span
          data-testid="home-ring-value"
          className="text-5xl font-bold tabular-nums text-foreground"
        >
          {centerValue}
        </span>
        <span className="text-sm font-medium text-muted-foreground">kcal</span>
        {isOver ? (
          <p
            data-testid="home-ring-overshoot-note"
            className="mt-1.5 max-w-[150px] text-[11px] leading-snug text-muted-foreground"
          >
            Jedan dan više ne menja ništa. Nastavi sutra kao i obično.
          </p>
        ) : null}
      </div>
    </div>
  );
}
