import { DayBars } from "@/components/weekly/day-bars";
import { WeeklyRing } from "@/components/weekly/weekly-ring";
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
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-card p-4">
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
    </div>
  );
}

export function WeeklyDashboard({ summary }: { summary: WeekSummary }) {
  const status = STATUS_META[summary.status];
  const hasData = summary.loggedDaysCount > 0;

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Napredak
        </h1>
        <p className="text-sm text-muted-foreground">Ova nedelja</p>
      </header>

      {/* Hero: weekly ring + on-track pill */}
      <section className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <WeeklyRing summary={summary} />
        {hasData ? (
          <div
            data-testid="week-status-pill"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5"
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
      </section>

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
    </main>
  );
}
