import type { WeekSummary } from "@/lib/week/summary";

// F041 / AS-068: the weekly hero ring -- spent vs the full-week budget, so
// the whole week is the visual unit and one heavy day only nudges the arc a
// little. Pure/presentational: every number comes from `computeWeekSummary`
// (`src/lib/week/summary.ts`), nothing is eyeballed here. Same calm posture
// as the daily `Ring`: overshoot is shown plainly (real number, "Prekoračeno"
// copy) and the arc stays the app's teal accent -- never a red alarm ring.

const RING_SIZE = 208;
const RING_RADIUS = 88;
const RING_STROKE = 15;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function WeeklyRing({ summary }: { summary: WeekSummary }) {
  const { weeklyBudget, spentKcal, remainingKcal, overshootKcal, isOver } =
    summary;

  const safeBudget = weeklyBudget > 0 ? weeklyBudget : 1;
  const percent = Math.min(100, Math.max(0, (spentKcal / safeBudget) * 100));
  const dashOffset = CIRCUMFERENCE * (1 - percent / 100);

  const centerLabel = isOver ? "Prekoračeno" : "Ostalo ove nedelje";
  const centerValue = isOver ? overshootKcal : remainingKcal;

  return (
    <div
      data-testid="weekly-ring"
      role="img"
      aria-label={`${centerLabel} ${centerValue} kcal od ${weeklyBudget} kcal nedeljno`}
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
          data-testid="weekly-ring-arc"
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

      <div className="absolute flex flex-col items-center justify-center gap-0.5 px-10 text-center">
        <span className="text-xs font-medium text-muted-foreground">
          {centerLabel}
        </span>
        <span
          data-testid="weekly-ring-value"
          className="text-4xl font-bold tabular-nums text-foreground"
        >
          {centerValue}
        </span>
        <span className="text-xs font-medium text-muted-foreground">kcal</span>
        <span className="mt-1 text-[11px] text-muted-foreground">
          od {weeklyBudget.toLocaleString("sr-RS")} nedeljno
        </span>
      </div>
    </div>
  );
}
