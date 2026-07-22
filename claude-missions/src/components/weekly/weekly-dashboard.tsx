import type { ReactNode } from "react";

import { BmiCard } from "@/components/analytics/bmi-card";
import { Card } from "@/components/ui/card";
import { DayBars } from "@/components/weekly/day-bars";
import type { WeekStatus, WeekSummary } from "@/lib/week/summary";

// F041 / AS-068..AS-071: the weekly dashboard body. Presentational: takes the
// fully-derived `WeekSummary` (server-computed by `computeWeekSummary`) and
// lays out the hero ring, on-track pill, key stats, and the per-day chart.
// sr-Latn, informal "ti", zero-shame tone throughout.

const STATUS_META: Record<
  WeekStatus,
  { label: string; dot: string; text: string }
> = {
  green: {
    label: "Na dobrom putu",
    dot: "var(--primary)",
    text: "var(--primary)",
  },
  yellow: {
    label: "Malo iznad cilja",
    dot: "var(--chart-5)",
    text: "var(--chart-5)",
  },
  red: {
    label: "Iznad cilja",
    dot: "var(--destructive)",
    text: "var(--destructive)",
  },
};

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-1 flex-col gap-1 p-4">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums text-foreground">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </Card>
  );
}

export function WeeklyDashboard({
  summary,
  bmi,
  weightSection,
  footer,
}: {
  summary: WeekSummary;
  /** The user's body-mass index (kg/m²), computed from their questionnaire
   * height + weight by the page. `null` when either is missing -- the card
   * then shows a calm "dopuni profil" state instead of a number. */
  bmi: number | null;
  /** F042/F043: the "Težina" section, rendered between the per-day chart and
   * the meal-history footer. Passed as a node (like `footer`) so the page
   * owns the server data read and this component stays presentational. */
  weightSection?: ReactNode;
  footer?: ReactNode;
}) {
  const status = STATUS_META[summary.status];
  const hasData = summary.loggedDaysCount > 0;

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analitika
        </h1>
        <p className="text-sm text-muted-foreground">Ova nedelja</p>
      </header>

      {/* Hero: the user's BMI from their questionnaire height + weight --
          value, category, a four-zone scale, and the standard thresholds. */}
      <BmiCard bmi={bmi} />

      {/* Weekly on-track signal (kept from the old hero -- this is the average
          vs target status, not a "remaining calories" number). */}
      <div className="flex justify-center">
        {hasData ? (
          <div
            data-testid="week-status-pill"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: status.dot }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: status.text }}
            >
              {status.label}
            </span>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Unesi obroke ove nedelje pa ćeš ovde videti kako stojiš.
          </p>
        )}
      </div>

      {/* Key stats */}
      <section className="flex gap-3">
        <StatCard
          label="Dnevni prosek"
          value={summary.dailyAverage.toLocaleString("sr-RS")}
          unit="kcal"
          hint={`Cilj ${summary.dailyTarget.toLocaleString("sr-RS")} kcal/dan`}
        />
        <StatCard
          label="Dana uneto"
          value={`${summary.loggedDaysCount}/${summary.elapsedDays}`}
          hint={
            summary.loggedDaysCount === summary.elapsedDays && hasData
              ? "Svaki dan — bravo!"
              : "ove nedelje"
          }
        />
      </section>

      {/* Per-day chart */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-foreground">Po danima</h2>
          <span className="text-xs text-muted-foreground">
            {summary.spentKcal.toLocaleString("sr-RS")} kcal ukupno
          </span>
        </div>
        <DayBars summary={summary} />
      </section>

      {/* F042/F043: weight + trend */}
      {weightSection}

      {/* "Svi obroci" meal-history log (bottom of the page) */}
      {footer}
    </main>
  );
}
