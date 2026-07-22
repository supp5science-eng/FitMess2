"use client";

import { useState } from "react";

import type { MacroWeek } from "@/lib/week/macro-weeks";
import { cn } from "@/lib/utils";

// Analitika "Dnevni prosek kalorija" card. Headline average + week-over-week
// change, a macro-stacked per-day bar chart (Pon..Ned), a macro legend, and a
// week selector (Ova nedelja / Prošla / Pre 2 / Pre 3). Presentational: every
// number arrives pre-computed from `computeMacroWeeks`.

// Macro colours: protein red, carbs amber, fats blue -- fixed semantic colours
// (not the theme accent) so they read the same in light and dark. Bars stack
// blue → amber → red bottom-to-top, matching the reference design.
const MACRO = {
  protein: { color: "#EF6E64", label: "Proteini" },
  carbs: { color: "#E0A45A", label: "Ugljeni hidrati" },
  fat: { color: "#5B8DEF", label: "Masti" },
} as const;

const TAB_LABELS = ["Ova nedelja", "Prošla", "Pre 2 ned.", "Pre 3 ned."] as const;

const CHART_HEIGHT = 176; // px

/** A "nice" y-axis scale: a round step (…/100/200/250/500…) and a max that
 * clears the tallest bar, giving ~3 gridlines. e.g. 547 → step 200, max 600. */
function niceScale(maxValue: number): { step: number; max: number } {
  const target = Math.max(maxValue, 100);
  const rough = target / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * pow).find((c) => c >= rough) ?? 10 * pow;
  const max = Math.ceil(target / step) * step;
  return { step, max };
}

export function MacroAverageCard({ weeks }: { weeks: MacroWeek[] }) {
  const [selected, setSelected] = useState(0);
  const week = weeks[selected] ?? weeks[0];

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Dnevni prosek kalorija
      </h2>

      {week ? <WeekBody week={week} /> : <EmptyBody />}

      {/* Week selector */}
      <div
        role="tablist"
        aria-label="Izbor nedelje"
        className="mt-1 flex gap-1 overflow-x-auto rounded-full bg-muted/60 p-1"
      >
        {TAB_LABELS.map((label, i) => {
          const active = i === selected;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(i)}
              className={cn(
                "flex-1 shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WeekBody({ week }: { week: MacroWeek }) {
  const hasData = week.loggedDaysCount > 0;
  const maxDay = Math.max(0, ...week.days.map((d) => d.totalKcal));
  const { step, max } = niceScale(maxDay);
  const gridValues: number[] = [];
  for (let v = 0; v <= max + 0.5; v += step) gridValues.push(Math.round(v));

  return (
    <>
      {/* Headline: average + week-over-week change */}
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span
          data-testid="daily-average-value"
          className="text-5xl font-bold leading-none tabular-nums text-foreground"
        >
          {hasData ? week.dailyAverageKcal.toLocaleString("sr-RS") : "—"}
        </span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          kcal
          {week.changePct != null ? <ChangeBadge pct={week.changePct} /> : null}
        </span>
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="relative pl-8">
          {/* y-axis labels */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 flex w-7 flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground"
            style={{ height: CHART_HEIGHT }}
          >
            {[...gridValues].reverse().map((v) => (
              <span key={v} className="-translate-y-1/2 leading-none">
                {v}
              </span>
            ))}
          </div>

          {/* plot area: gridlines + bars */}
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            {gridValues.map((v) => (
              <div
                key={v}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-dashed border-border/70"
                style={{ bottom: `${(v / max) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end justify-between gap-1.5">
              {week.days.map((day) => (
                <DayBar key={day.dayKey} day={day} max={max} />
              ))}
            </div>
          </div>

          {/* x-axis labels */}
          <div className="mt-1.5 flex justify-between gap-1.5">
            {week.days.map((day) => (
              <span
                key={day.dayKey}
                className={cn(
                  "flex-1 text-center text-[11px]",
                  day.logged
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {day.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nema unetih obroka u ovoj nedelji.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {(["protein", "carbs", "fat"] as const).map((key) => (
          <span
            key={key}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: MACRO[key].color }}
            />
            {MACRO[key].label}
          </span>
        ))}
      </div>
    </>
  );
}

/** One day's macro-stacked bar. Segments (top→bottom: protein, carbs, fat) sit
 * inside a rounded, clipped wrapper whose height is the day's kcal share. */
function DayBar({
  day,
  max,
}: {
  day: MacroWeek["days"][number];
  max: number;
}) {
  const share = (kcal: number) =>
    day.totalKcal > 0 ? `${(kcal / day.totalKcal) * 100}%` : "0%";

  // A logged day with kcal but no macro breakdown falls back to one muted bar.
  const noMacros =
    day.totalKcal > 0 &&
    day.proteinKcal + day.carbsKcal + day.fatKcal === 0;

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-end">
      <div
        className="w-full max-w-[22px] overflow-hidden rounded-md"
        style={{ height: `${(day.totalKcal / max) * 100}%` }}
      >
        {noMacros ? (
          <div className="h-full w-full bg-muted-foreground/40" />
        ) : (
          <>
            <div style={{ height: share(day.proteinKcal), backgroundColor: MACRO.protein.color }} />
            <div style={{ height: share(day.carbsKcal), backgroundColor: MACRO.carbs.color }} />
            <div style={{ height: share(day.fatKcal), backgroundColor: MACRO.fat.color }} />
          </>
        )}
      </div>
    </div>
  );
}

function ChangeBadge({ pct }: { pct: number }) {
  const down = pct < 0;
  const color = down ? "#E0685E" : "#22B573";
  const arrow = down ? "↓" : "↑";
  const sign = pct > 0 ? "+" : "";
  return (
    <span
      data-testid="daily-average-change"
      className="inline-flex items-center gap-0.5 text-sm font-semibold"
      style={{ color }}
    >
      <span aria-hidden="true">{arrow}</span>
      {sign}
      {pct}%
    </span>
  );
}

function EmptyBody() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Počni da beležiš obroke pa ćeš ovde videti svoj dnevni prosek.
    </p>
  );
}
