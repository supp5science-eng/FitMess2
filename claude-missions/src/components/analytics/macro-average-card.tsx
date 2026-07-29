"use client";

import { useState } from "react";

import { ChartHint, ChartReadout } from "@/components/analytics/chart-readout";
import type { MacroDay, MacroWeek } from "@/lib/week/macro-weeks";
import { cn } from "@/lib/utils";

// Analitika "Dnevni prosek kalorija" card. Headline average + week-over-week
// change, a macro-stacked per-day bar chart (Pon..Ned), a macro legend, and a
// week selector (Ova nedelja / Prošla / Pre 2 / Pre 3). Presentational: every
// number arrives pre-computed from `computeMacroWeeks`.
//
// The bars are TAPPABLE (2026-07-25): each one is a button that names its day
// and prints that day's kcal + macro grams in the shared read-out. Switching
// weeks clears the selection -- a read-out from last week hanging over this
// week's chart would be worse than none.

// Macro colours: protein red, carbs amber, fats blue -- fixed semantic colours
// Macro colours come from the shared `--macro-*` tokens so the whole app agrees:
// protein = green, carbs = yellow, fat = red. Bars stack green → yellow → red
// top-to-bottom (protein, carbs, fat).
const MACRO = {
  protein: { color: "var(--macro-protein)", label: "Proteini" },
  carbs: { color: "var(--macro-carbs)", label: "Ugljeni hidrati" },
  fat: { color: "var(--macro-fat)", label: "Masti" },
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
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const week = weeks[selected] ?? weeks[0];

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Dnevni prosek kalorija
      </h2>

      {week ? (
        <WeekBody
          week={week}
          selectedDayKey={selectedDayKey}
          onSelectDay={(dayKey) =>
            setSelectedDayKey((current) => (current === dayKey ? null : dayKey))
          }
        />
      ) : (
        <EmptyBody />
      )}

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
              onClick={() => {
                setSelected(i);
                setSelectedDayKey(null);
              }}
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

function WeekBody({
  week,
  selectedDayKey,
  onSelectDay,
}: {
  week: MacroWeek;
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
}) {
  const hasData = week.loggedDaysCount > 0;
  const selectedDay =
    week.days.find((d) => d.dayKey === selectedDayKey) ?? null;
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
                <DayBar
                  key={day.dayKey}
                  day={day}
                  max={max}
                  active={day.dayKey === selectedDayKey}
                  onSelect={() => onSelectDay(day.dayKey)}
                />
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
                  day.dayKey === selectedDayKey
                    ? "font-semibold text-foreground"
                    : day.logged
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

      {/* Tap read-out: the picked day's real kcal + macro grams. */}
      {hasData ? (
        selectedDay ? (
          <ChartReadout
            label={selectedDay.longLabel}
            primary={
              selectedDay.logged
                ? `${selectedDay.totalKcal.toLocaleString("sr-RS")} kcal`
                : "Nema unosa"
            }
            secondary={macroLine(selectedDay)}
            onClear={() => onSelectDay(selectedDay.dayKey)}
            testId="macro-readout"
          />
        ) : (
          <ChartHint testId="macro-hint">
            Dodirni stubić da vidiš tačan unos tog dana.
          </ChartHint>
        )
      ) : null}

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

/** The read-out's second line: the day's macro grams, or why there are none. */
function macroLine(day: MacroDay): string {
  if (!day.logged) {
    return day.isFuture
      ? "Taj dan tek dolazi."
      : "Tog dana nije unet nijedan obrok.";
  }
  return `P ${day.proteinG} g · UH ${day.carbsG} g · M ${day.fatG} g`;
}

/** One day's macro-stacked bar, as a button. Segments (top→bottom: protein,
 * carbs, fat) sit inside a rounded, clipped wrapper whose height is the day's
 * kcal share. */
function DayBar({
  day,
  max,
  active,
  onSelect,
}: {
  day: MacroDay;
  max: number;
  active: boolean;
  onSelect: () => void;
}) {
  const share = (kcal: number) =>
    day.totalKcal > 0 ? `${(kcal / day.totalKcal) * 100}%` : "0%";

  // A logged day with kcal but no macro breakdown falls back to one muted bar.
  const noMacros =
    day.totalKcal > 0 &&
    day.proteinKcal + day.carbsKcal + day.fatKcal === 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${day.longLabel}: ${
        day.logged ? `${day.totalKcal} kcal` : "nema unosa"
      }`}
      data-testid={`macro-bar-${day.dayKey}`}
      className={cn(
        "flex h-full flex-1 flex-col items-center justify-end rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-foreground/[0.06]" : "bg-transparent"
      )}
    >
      <span
        className={cn(
          "block w-full max-w-[22px] overflow-hidden rounded-md transition-opacity",
          active ? "opacity-100" : undefined
        )}
        style={{ height: `${(day.totalKcal / max) * 100}%` }}
      >
        {noMacros ? (
          <span className="block h-full w-full bg-muted-foreground/40" />
        ) : (
          <>
            <span className="block" style={{ height: share(day.proteinKcal), backgroundColor: MACRO.protein.color }} />
            <span className="block" style={{ height: share(day.carbsKcal), backgroundColor: MACRO.carbs.color }} />
            <span className="block" style={{ height: share(day.fatKcal), backgroundColor: MACRO.fat.color }} />
          </>
        )}
      </span>
    </button>
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
