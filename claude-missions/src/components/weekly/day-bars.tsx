import type { WeekSummary } from "@/lib/week/summary";

// F041 / AS-071 (per-day totals) + AS-070 (daily target reference): the
// Mon..Sun mini bar chart. Pure/presentational -- heights come straight from
// `computeWeekSummary`'s per-day kcal. A dashed line marks the daily target
// so a day reads as "over" or "under" at a glance, without ever coloring a
// day red (zero-shame): over-target days just get a warm cap, logged days the
// teal accent, future/empty days a faint track.

const CHART_HEIGHT = 128;

export function DayBars({ summary }: { summary: WeekSummary }) {
  const { days, dailyTarget } = summary;

  const maxKcal = Math.max(0, ...days.map((day) => day.kcal));
  // Scale so the target line sits comfortably inside the chart even on a
  // light week; never divide by zero.
  const scale = Math.max(dailyTarget * 1.15, maxKcal, 1);
  const targetPct = dailyTarget > 0 ? (dailyTarget / scale) * 100 : 0;

  return (
    <div data-testid="week-day-bars" className="flex flex-col gap-2">
      <div
        className="relative flex items-end justify-between gap-1.5"
        style={{ height: CHART_HEIGHT }}
      >
        {/* Daily-target reference line */}
        {targetPct > 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${targetPct}%` }}
          />
        ) : null}

        {days.map((day) => {
          const heightPct =
            day.kcal > 0 ? Math.max(4, (day.kcal / scale) * 100) : 0;
          const isOverTarget = dailyTarget > 0 && day.kcal > dailyTarget;

          return (
            <div
              key={day.dayKey}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              data-testid={`week-day-${day.weekdayIndex}`}
            >
              {day.kcal > 0 ? (
                <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                  {day.kcal >= 1000
                    ? `${(day.kcal / 1000).toFixed(1)}k`
                    : day.kcal}
                </span>
              ) : null}
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: `${heightPct}%`,
                  minHeight: day.kcal > 0 ? 4 : 0,
                  backgroundColor: isOverTarget
                    ? "var(--chart-5)"
                    : "var(--primary)",
                  opacity: day.isFuture ? 0.15 : 1,
                }}
              />
              {/* Empty-day track so the column still has a baseline mark */}
              {day.kcal === 0 ? (
                <div className="h-1 w-full rounded-full bg-muted" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-1.5">
        {days.map((day) => (
          <span
            key={day.dayKey}
            className={`flex-1 text-center text-[11px] font-medium ${
              day.isToday ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {day.label}
          </span>
        ))}
      </div>
    </div>
  );
}
