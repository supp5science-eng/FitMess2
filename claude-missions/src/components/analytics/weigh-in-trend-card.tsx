"use client";

import { useT } from "@/components/i18n/locale-provider";
import type { WeighInChart } from "@/lib/weight/weigh-in-chart";

/**
 * Analitika "Merenja" card: the real weigh-ins, and the line through them.
 *
 * Deliberately quieter than the neighbouring "Procena težine" card, which
 * ESTIMATES weight from calorie balance. This one plots numbers the user read
 * off a scale, so it adds no interpretation of its own -- the interpretation
 * lives on `/merenje`, where it comes with a decision attached.
 *
 * The dots are drawn hollow and the fitted line solid, so it is visually
 * obvious which is the measurement and which is the reading of it.
 */

const VB_W = 320;
const VB_H = 92;
const PAD_X = 12;
const PAD_Y = 12;

function fmtKg(kg: number, digits = 1): string {
  return kg.toLocaleString("sr-RS", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtChange(kg: number): string {
  const sign = kg > 0 ? "+" : kg < 0 ? "−" : "";
  return `${sign}${fmtKg(Math.abs(kg), 2)} kg`;
}

export function WeighInTrendCard({ chart }: { chart: WeighInChart | null }) {
  const { t } = useT();

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t("merenje.chart.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("merenje.chart.subtitle")}
        </p>
      </div>

      {chart ? (
        <>
          <TrendPlot chart={chart} />

          <div className="h-px bg-border" />

          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span
                data-testid="weigh-in-chart-change"
                className="text-3xl font-bold tabular-nums text-foreground"
              >
                {fmtChange(chart.changeKg)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("merenje.chart.changeLabel", {
                  days: String(chart.spanDays),
                })}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {fmtKg(chart.currentKg)} kg
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("merenje.chart.currentLabel")}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          {t("merenje.chart.empty")}
        </p>
      )}
    </section>
  );
}

function TrendPlot({ chart }: { chart: WeighInChart }) {
  const span = Math.max(chart.maxKg - chart.minKg, 0.001);
  const xFor = (x: number) => PAD_X + x * (VB_W - 2 * PAD_X);
  // Heavier sits higher up (smaller y), like every weight chart people know.
  const yFor = (kg: number) =>
    PAD_Y + (1 - (kg - chart.minKg) / span) * (VB_H - 2 * PAD_Y);

  const first = chart.points[0]!;
  const last = chart.points[chart.points.length - 1]!;

  // The measured path: straight segments between real readings. No smoothing --
  // a curve here would invent weights on days nobody stepped on a scale.
  const measuredPath = chart.points
    .map(
      (point, i) =>
        `${i === 0 ? "M" : "L"}${xFor(point.x).toFixed(1)},${yFor(point.weightKg).toFixed(1)}`
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={`${fmtChange(chart.changeKg)} · ${fmtKg(chart.currentKg)} kg`}
      data-testid="weigh-in-chart"
    >
      {/* The fit: one straight line from the first day to the last. */}
      <line
        x1={xFor(first.x)}
        y1={yFor(first.fittedKg)}
        x2={xFor(last.x)}
        y2={yFor(last.fittedKg)}
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <path
        d={measuredPath}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth={1.25}
        strokeOpacity={0.45}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {chart.points.map((point) => (
        <circle
          key={point.dayKey}
          cx={xFor(point.x)}
          cy={yFor(point.weightKg)}
          r={3.5}
          fill="var(--card)"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
