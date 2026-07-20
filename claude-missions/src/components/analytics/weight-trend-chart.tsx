import type { WeightTrend } from "@/lib/weight/trend";

// F043 / AS-074 (a rolling-average trend line is the prominent element),
// AS-075 (raw weigh-ins are shown as muted points, distinct from the line):
// the weight-trend chart. Hand-rolled SVG, purely presentational and
// server-renderable (no client JS) -- same approach as `DayBars` /
// `WeeklyRing`, no charting library (the app deliberately hand-draws its
// charts). Every number comes pre-computed from `computeWeightTrend`; this
// component only maps the domain onto pixels.
//
// Geometry is a fixed `viewBox` scaled to the card width via `w-full`, so the
// 10-11px label text stays crisp and legible at 375px. A left gutter holds
// the two y labels, a bottom gutter the first/last day labels. The goal line
// (if any) is a warm dashed reference -- the SAME "over/under at a glance,
// never a punitive red" language `DayBars`' daily-target line uses.

const VB_W = 295;
const VB_H = 150;
const GUTTER_LEFT = 34;
const GUTTER_BOTTOM = 18;
const PAD_TOP = 8;
const PAD_RIGHT = 8;

const PLOT_LEFT = GUTTER_LEFT;
const PLOT_RIGHT = VB_W - PAD_RIGHT;
const PLOT_TOP = PAD_TOP;
const PLOT_BOTTOM = VB_H - GUTTER_BOTTOM;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;

/** One decimal, Serbian formatting (comma decimal separator). */
function fmtKg(n: number): string {
  return n.toLocaleString("sr-RS", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function WeightTrendChart({
  trend,
  firstDayLabel,
  lastDayLabel,
}: {
  trend: WeightTrend;
  /** Pre-formatted first-day axis label (from `formatTrendDayLabel` on the
   * server, so the "danas" decision uses the Belgrade frame, not a client
   * clock). */
  firstDayLabel: string;
  lastDayLabel: string;
}) {
  const { points, minKg, maxKg, goalWeightKg } = trend;
  const span = Math.max(maxKg - minKg, 0.001);

  // Map a weight (kg) to a y pixel: higher weight -> higher up the chart.
  const yFor = (kg: number) =>
    PLOT_BOTTOM - ((kg - minKg) / span) * PLOT_H;
  // Map a point's normalized x (0..1) to an x pixel.
  const xFor = (x: number) => PLOT_LEFT + x * PLOT_W;

  const goalInDomain =
    goalWeightKg != null && goalWeightKg >= minKg && goalWeightKg <= maxKg;
  const goalY = goalInDomain ? yFor(goalWeightKg!) : 0;

  const avgLine = points
    .map((p) => `${xFor(p.x).toFixed(2)},${yFor(p.rollingAvgKg).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label="Grafikon težine kroz vreme"
      data-testid="weight-trend-chart"
    >
      {/* y-axis labels: bottom (min) and top (max) of the domain */}
      <text
        x={PLOT_LEFT - 6}
        y={yFor(maxKg)}
        textAnchor="end"
        dominantBaseline="hanging"
        className="fill-muted-foreground text-[10px] tabular-nums"
      >
        {fmtKg(maxKg)}
      </text>
      <text
        x={PLOT_LEFT - 6}
        y={yFor(minKg)}
        textAnchor="end"
        dominantBaseline="auto"
        className="fill-muted-foreground text-[10px] tabular-nums"
      >
        {fmtKg(minKg)}
      </text>

      {/* Goal reference line (warm, dashed -- never a punitive red) */}
      {goalInDomain ? (
        <>
          <line
            x1={PLOT_LEFT}
            y1={goalY}
            x2={PLOT_RIGHT}
            y2={goalY}
            stroke="var(--chart-5)"
            strokeWidth={1}
            strokeDasharray="4 4"
            data-testid="weight-trend-goal-line"
          />
          <text
            x={PLOT_RIGHT}
            y={goalY - 3}
            textAnchor="end"
            className="fill-[var(--chart-5)] text-[9px] tabular-nums"
          >
            Cilj {fmtKg(goalWeightKg!)} kg
          </text>
        </>
      ) : null}

      {/* Rolling-average trend line: the prominent element (AS-074) */}
      {points.length >= 2 ? (
        <polyline
          points={avgLine}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="weight-trend-avg-line"
        />
      ) : null}

      {/* Raw weigh-ins: muted points, distinct from the line (AS-075) */}
      {points.map((p) => (
        <circle
          key={p.day}
          cx={xFor(p.x)}
          cy={yFor(p.weightKg)}
          r={2.5}
          fill="var(--muted-foreground)"
          fillOpacity={0.55}
        />
      ))}

      {/* x-axis labels: first and last day only */}
      <text
        x={PLOT_LEFT}
        y={VB_H - 5}
        textAnchor="start"
        className="fill-muted-foreground text-[10px]"
      >
        {firstDayLabel}
      </text>
      {points.length >= 2 ? (
        <text
          x={PLOT_RIGHT}
          y={VB_H - 5}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {lastDayLabel}
        </text>
      ) : null}
    </svg>
  );
}
