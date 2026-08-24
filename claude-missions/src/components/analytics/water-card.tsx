"use client";

import { useState } from "react";

import { ChartHint, ChartReadout } from "@/components/analytics/chart-readout";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import {
  formatWaterSr,
  type WaterDay,
  type WaterWeek,
} from "@/lib/water/water-week";
import { cn } from "@/lib/utils";

// Analitika "Voda" card: today's hydration vs a bodyweight-based goal (a sky
// progress ring) plus a 7-day mini bar chart with a dashed goal line. Every
// number arrives pre-computed from `computeWaterWeek`. Water is logged on
// `/danas`; this card is the read-only overview. `null` => a calm "dopuni
// profil" state.
//
// Client since 2026-07-25 for the tappable bars: each column is a real button
// that names its day and its litres in the shared read-out, so a short bar is
// answerable ("Utorak — 0,75 L, 30% cilja") instead of merely visible.

const SKY = "#1A6D92"; // `--mark-water`, matching the /danas water button

// Ring geometry.
const RING = 108;
const R = 46;
const STROKE = 9;
const CIRC = 2 * Math.PI * R;

// Bar chart geometry.
const CHART_H = 88;

/** The read-out's second line: goal progress, or an honest "nothing logged". */
function secondaryFor(day: WaterDay, goalMl: number, t: TFunction): string {
  if (day.ml === 0) return t("analytics.water.noWaterThatDay");
  if (day.reached)
    return t("analytics.water.goalReached", { goal: formatWaterSr(goalMl) });
  return t("analytics.water.pctOfGoal", {
    pct: Math.round(day.pct * 100),
    goal: formatWaterSr(goalMl),
  });
}

export function WaterCard({ week }: { week: WaterWeek | null }) {
  const { t } = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (!week) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="text-sm text-muted-foreground">
          {t("analytics.water.empty")}
        </p>
      </section>
    );
  }

  const selected = week.days.find((d) => d.dayKey === selectedKey) ?? null;
  const dashOffset = CIRC * (1 - week.pct);
  const hint = week.reachedToday
    ? t("analytics.water.goalReachedShort")
    : t("analytics.water.remaining", { amount: formatWaterSr(week.remainingMl) });

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6">
      <Header />

      {/* Hero: progress ring + today's total */}
      <div className="flex items-center gap-5">
        <div
          className="relative shrink-0"
          style={{ width: RING, height: RING }}
        >
          <svg
            width={RING}
            height={RING}
            viewBox={`0 0 ${RING} ${RING}`}
            className="-rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke={SKY}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-lg leading-none" aria-hidden="true">
              💧
            </span>
            <span
              data-testid="water-pct"
              className="text-lg font-bold tabular-nums text-foreground"
            >
              {Math.round(week.pct * 100)}%
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            data-testid="water-today"
            className="text-3xl font-bold tabular-nums text-foreground"
          >
            {formatWaterSr(week.todayMl)}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("analytics.water.ofGoal", { goal: formatWaterSr(week.goalMl) })}
          </span>
          <span
            className="mt-0.5 text-[11px] font-medium"
            style={{ color: week.reachedToday ? "var(--primary)" : SKY }}
          >
            {hint}
          </span>
        </div>
      </div>

      {/* 7-day mini bars with a dashed goal line */}
      <div>
        <div className="relative" style={{ height: CHART_H }}>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${(week.goalMl / week.maxMl) * 100}%` }}
          />
          <div className="absolute inset-0 flex items-end justify-between gap-1.5">
            {week.days.map((d) => {
              const active = d.dayKey === selectedKey;
              return (
                <button
                  key={d.dayKey}
                  type="button"
                  aria-label={`${d.longLabel}: ${formatWaterSr(d.ml)}`}
                  aria-pressed={active}
                  data-testid={`water-bar-${d.dayKey}`}
                  onClick={() =>
                    setSelectedKey((current) =>
                      current === d.dayKey ? null : d.dayKey
                    )
                  }
                  className={cn(
                    "flex h-full flex-1 flex-col items-center justify-end rounded-md transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "bg-foreground/[0.06]" : "bg-transparent"
                  )}
                >
                  <span
                    className="w-full max-w-[22px] rounded-md rounded-b-none"
                    style={{
                      height: `${(d.ml / week.maxMl) * 100}%`,
                      backgroundColor: SKY,
                      // A picked day always reads at full strength, so the bar
                      // and the read-out below obviously belong together.
                      opacity: d.ml === 0 ? 0 : d.isToday || active ? 1 : 0.5,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between gap-1.5">
          {week.days.map((d) => (
            <span
              key={d.dayKey}
              className={
                "flex-1 text-center text-[11px] " +
                (d.isToday || d.dayKey === selectedKey
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground")
              }
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {selected ? (
        <ChartReadout
          label={selected.longLabel}
          primary={formatWaterSr(selected.ml)}
          secondary={secondaryFor(selected, week.goalMl, t)}
          accentColor={selected.reached ? SKY : undefined}
          onClear={() => setSelectedKey(null)}
          testId="water-readout"
        />
      ) : (
        <ChartHint testId="water-hint">
          {t("analytics.water.hint")}
        </ChartHint>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        {t("analytics.water.weekAvg", { avg: formatWaterSr(week.weekAvgMl) })}
      </p>
    </section>
  );
}

function Header() {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: "rgba(56,189,248,0.15)" }}
      >
        💧
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        {t("analytics.water.title")}
      </h2>
      <span className="ml-auto text-xs text-muted-foreground">
        {t("analytics.water.subtitle")}
      </span>
    </div>
  );
}
