"use client";

import { useState } from "react";

import {
  ChartHint,
  ChartReadout,
  DayTapTargets,
} from "@/components/analytics/chart-readout";
import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { formatSteps, type StepsDay, type StepsWeek } from "@/lib/steps/steps-week";

// Analitika "Koraci" card: a 7-day steps line chart in the same clean language
// as the "Procena težine" card -- a smooth green line with hollow dots over a
// soft gradient, a divider, then today's total with a goal note. Every number
// arrives pre-computed from `computeStepsWeek`; steps are logged on `/danas`,
// this card is the overview.
//
// Client since 2026-07-25 for ONE reason: the chart is tappable. Picking a day
// highlights its dot and names it in the shared read-out (`ChartReadout`), so
// "which day was that tall one, and how many steps was it?" is one tap instead
// of guesswork. Nothing else about the card became interactive.

const LINE = "#5F43A0"; // `--mark-steps`, matching the /danas steps tile

const VB_W = 320;
const VB_H = 92;
const PAD_X = 12;
const PAD_Y = 12;

export function StepsCard({ week }: { week: StepsWeek | null }) {
  const { t } = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (!week) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="py-4 text-sm text-muted-foreground">
          {t("analytics.steps.loadError")}
        </p>
      </section>
    );
  }

  const today = week.days[week.days.length - 1]!;
  const todayHint = today.reached
    ? t("analytics.steps.goalReachedShort")
    : t("analytics.steps.pctOfGoal", { pct: Math.round(today.pct * 100) });
  const selected = week.days.find((d) => d.dayKey === selectedKey) ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <Header />

      <div className="relative">
        <Sparkline week={week} selectedKey={selectedKey} />
        <DayTapTargets
          days={week.days}
          selectedKey={selectedKey}
          onSelect={(dayKey) =>
            setSelectedKey((current) => (current === dayKey ? null : dayKey))
          }
          ariaLabel={(day) => {
            const match = week.days.find((d) => d.dayKey === day.dayKey)!;
            return `${day.longLabel}: ${t("analytics.steps.stepsCount", {
              steps: formatSteps(match.steps),
            })}`;
          }}
        />
      </div>

      {selected ? (
        <ChartReadout
          label={selected.longLabel}
          primary={t("analytics.steps.stepsCount", {
            steps: formatSteps(selected.steps),
          })}
          secondary={secondaryFor(selected, week.goalSteps, t)}
          accentColor={selected.reached ? LINE : undefined}
          onClear={() => setSelectedKey(null)}
          testId="steps-readout"
        />
      ) : (
        <ChartHint testId="steps-hint">
          {t("analytics.steps.hint")}
        </ChartHint>
      )}

      <div className="h-px bg-border" />

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span
            data-testid="steps-today"
            className="text-3xl font-bold tabular-nums text-foreground"
          >
            {formatSteps(today.steps)}
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: today.reached ? LINE : "var(--muted-foreground)" }}
          >
            {t("analytics.steps.todayLine", { hint: todayHint })}
          </span>
        </div>

        <span
          data-testid="steps-avg"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: LINE }}
          />
          {t("analytics.steps.avgPerDay", {
            steps: formatSteps(week.weekAvgSteps),
          })}
        </span>
      </div>
    </section>
  );
}

/** The read-out's second line: goal progress, or an honest "no steps logged". */
function secondaryFor(day: StepsDay, goalSteps: number, t: TFunction): string {
  if (day.steps === 0) return t("analytics.steps.noStepsThatDay");
  if (day.reached)
    return t("analytics.steps.goalReached", { goal: formatSteps(goalSteps) });
  return t("analytics.steps.pctOfGoalValue", {
    pct: Math.round(day.pct * 100),
    goal: formatSteps(goalSteps),
  });
}

function Sparkline({
  week,
  selectedKey,
}: {
  week: StepsWeek;
  selectedKey: string | null;
}) {
  const { t } = useT();
  const max = Math.max(week.maxSteps, 1);
  const points = week.days.map((d, i) => ({
    x: i / (week.days.length - 1),
    steps: d.steps,
  }));

  const xFor = (x: number) => PAD_X + x * (VB_W - 2 * PAD_X);
  // Steps sit on a 0 baseline; higher counts sit higher up (smaller y).
  const yFor = (steps: number) =>
    PAD_Y + (1 - steps / max) * (VB_H - 2 * PAD_Y);

  const coords = points.map((p) => ({ x: xFor(p.x), y: yFor(p.steps) }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${VB_H} ` +
    `L${coords[0]!.x.toFixed(1)},${VB_H} Z`;

  const selectedIndex = week.days.findIndex((d) => d.dayKey === selectedKey);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label={t("analytics.steps.chartAria", {
        steps: formatSteps(week.weekAvgSteps),
      })}
      data-testid="steps-chart"
    >
      <defs>
        <linearGradient id="stepsTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE} stopOpacity={0.24} />
          <stop offset="100%" stopColor={LINE} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#stepsTrendFill)" />
      <path
        d={linePath}
        fill="none"
        stroke={LINE}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* A vertical guide drops from the picked day so the read-out below is
          unmistakably about THAT column. */}
      {selectedIndex >= 0 ? (
        <line
          x1={coords[selectedIndex]!.x}
          y1={0}
          x2={coords[selectedIndex]!.x}
          y2={VB_H}
          stroke={LINE}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
      ) : null}

      {/* Hollow dots (fill = card so the line doesn't show through the center);
          the selected day fills in and grows. */}
      {coords.map((c, i) => {
        const active = i === selectedIndex;
        return (
          <circle
            key={week.days[i]!.dayKey}
            cx={c.x}
            cy={c.y}
            r={active ? 6 : 4}
            fill={active ? LINE : "var(--card)"}
            stroke={LINE}
            strokeWidth={2.5}
          />
        );
      })}
    </svg>
  );
}

function Header() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {t("analytics.steps.title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("analytics.steps.subtitle")}
      </p>
    </div>
  );
}
