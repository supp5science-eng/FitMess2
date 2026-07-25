"use client";

import { Beef, Candy, Soup, Wheat } from "lucide-react";
import { useState } from "react";

import { ChartHint, ChartReadout } from "@/components/analytics/chart-readout";
import {
  formatMicroAmount,
  saltGramsFromSodiumMg,
  type MicroKey,
} from "@/lib/nutrition/micro";
import type {
  MicroNutrientWeek,
  MicroWeek,
  MicroWeekDay,
} from "@/lib/nutrition/micro-week";
import { cn } from "@/lib/utils";

// Analitika "Mikronutrijenti" card: the weekly counterpart to the four cards on
// the home tab's second page. One nutrient at a time (tabs: Vlakna / Šećer / So
// / Zasićene), showing the 7-day daily average against its goal or ceiling, a
// per-day bar chart with a dashed target line, and how many days landed inside
// the target.
//
// Presentational: every number arrives pre-computed from `computeMicroWeek`.
// Client only because of the tab state -- there is no data fetching here.
//
// Two rules carried over from the home cards, deliberately:
//   * A day we can't describe draws NO bar and is called out in the footer
//     (unknown is never a confident zero -- `0017_micronutrients.sql`).
//   * Past a ceiling the card stays calm: an amber tint and a plain sentence,
//     never red-alarm shaming. Same posture as the calorie ring's overshoot.

/** Per-nutrient accent, matching the home tab's micro cards exactly so the two
 * screens read as the same feature. */
const STYLE: Record<
  MicroKey,
  { color: string; icon: React.ReactNode; chip: string; text: string }
> = {
  fiber: {
    color: "#10b981",
    icon: <Wheat className="size-4" aria-hidden="true" />,
    chip: "bg-emerald-500/15",
    text: "text-emerald-500",
  },
  sugar: {
    color: "#ec4899",
    icon: <Candy className="size-4" aria-hidden="true" />,
    chip: "bg-pink-500/15",
    text: "text-pink-500",
  },
  sodium: {
    color: "#0ea5e9",
    icon: <Soup className="size-4" aria-hidden="true" />,
    chip: "bg-sky-500/15",
    text: "text-sky-500",
  },
  satFat: {
    color: "#f59e0b",
    icon: <Beef className="size-4" aria-hidden="true" />,
    chip: "bg-amber-500/15",
    text: "text-amber-500",
  },
};

/** Short tab labels ("Zasićene masti" is too wide for a quarter of the row). */
const TAB_LABEL: Record<MicroKey, string> = {
  fiber: "Vlakna",
  sugar: "Šećer",
  sodium: "So",
  satFat: "Zasićene",
};

/** The calm amber used for a day/average past a ceiling. */
const OVER = "#f59e0b";

const CHART_HEIGHT = 132; // px

export function MicroWeekCard({ week }: { week: MicroWeek | null }) {
  const [selected, setSelected] = useState<MicroKey>("fiber");
  // The tapped day, shared across tabs: switching nutrient keeps the day and
  // just re-reads it, which is exactly what "what was Wednesday like?" wants.
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  if (!week || week.nutrients.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6">
        <Header />
        <p className="text-sm text-muted-foreground">
          Nismo uspeli da učitamo mikronutrijente. Osveži stranicu pa pokušaj
          ponovo.
        </p>
      </section>
    );
  }

  const nutrient =
    week.nutrients.find((n) => n.key === selected) ?? week.nutrients[0]!;

  return (
    <section
      data-testid="micro-week-card"
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6"
    >
      <Header />

      {/* Nutrient selector */}
      <div
        role="tablist"
        aria-label="Izbor mikronutrijenta"
        className="flex gap-1 rounded-full bg-muted/60 p-1"
      >
        {week.nutrients.map((n) => {
          const active = n.key === selected;
          return (
            <button
              key={n.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(n.key)}
              data-testid={`micro-week-tab-${n.key}`}
              className={cn(
                "flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TAB_LABEL[n.key]}
            </button>
          );
        })}
      </div>

      {week.isEmpty ? (
        <p
          data-testid="micro-week-empty"
          className="py-8 text-center text-sm text-muted-foreground"
        >
          Još nemamo podatke o vlaknima, šećeru i soli za ovu nedelju. Pojaviće
          se čim počneš da beležiš obroke.
        </p>
      ) : (
        <NutrientBody
          nutrient={nutrient}
          selectedDayKey={selectedDayKey}
          onSelectDay={(dayKey) =>
            setSelectedDayKey((current) => (current === dayKey ? null : dayKey))
          }
        />
      )}
    </section>
  );
}

function NutrientBody({
  nutrient,
  selectedDayKey,
  onSelectDay,
}: {
  nutrient: MicroNutrientWeek;
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
}) {
  const style = STYLE[nutrient.key];
  const { unit, kind, labelSr } = nutrient.spec;
  const over = nutrient.status === "over";
  const selectedDay =
    nutrient.days.find((d) => d.dayKey === selectedDayKey) ?? null;

  return (
    <>
      {/* Headline: the week's daily average vs the goal/ceiling */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            data-testid="micro-week-average"
            className="text-4xl font-bold leading-none tabular-nums text-foreground"
          >
            {nutrient.average === null
              ? "—"
              : formatMicroAmount(nutrient.average, unit)}
          </span>
          <span className="text-sm text-muted-foreground">
            {labelSr} · prosečno dnevno
          </span>
          {nutrient.key === "sodium" && nutrient.average !== null ? (
            <span className="text-[11px] text-muted-foreground">
              ≈ {saltGramsFromSodiumMg(nutrient.average).toFixed(1).replace(".", ",")} g soli
            </span>
          ) : null}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
            style.chip,
            style.text
          )}
        >
          {kind === "goal" ? "cilj" : "granica"}{" "}
          {formatMicroAmount(nutrient.target, unit)}
        </span>
      </div>

      {/* Status line -- one plain sentence, calm even past a ceiling */}
      <p
        data-testid="micro-week-status"
        className="text-sm font-medium"
        style={{ color: over ? OVER : "var(--muted-foreground)" }}
      >
        {statusSentence(nutrient)}
      </p>

      {/* 7-day bars with a dashed target line */}
      <div>
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{
              bottom: `${(nutrient.target / nutrient.chartMax) * 100}%`,
            }}
          />
          <div className="absolute inset-0 flex items-end justify-between gap-1.5">
            {nutrient.days.map((day) => {
              const missing = day.value === null;
              // Past a ceiling the bar goes amber; short of the fiber goal it
              // just dims. Today always reads at full strength.
              const dayOver = !missing && kind === "limit" && !day.inTarget;
              const active = day.dayKey === selectedDayKey;
              return (
                <button
                  key={day.dayKey}
                  type="button"
                  onClick={() => onSelectDay(day.dayKey)}
                  aria-pressed={active}
                  aria-label={`${day.longLabel}: ${
                    missing
                      ? "nema dovoljno podataka"
                      : formatMicroAmount(day.value ?? 0, unit)
                  }`}
                  data-testid={`micro-week-day-${day.dayKey}`}
                  className={cn(
                    "flex h-full flex-1 flex-col items-center justify-end rounded-md transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "bg-foreground/[0.06]" : "bg-transparent"
                  )}
                >
                  {missing ? (
                    // No bar for a day we can't describe -- a short muted stub
                    // marks the slot as "nothing measured", not "you ate none".
                    <span
                      aria-hidden="true"
                      className="w-full max-w-[22px] rounded-full bg-muted-foreground/20"
                      style={{ height: 3 }}
                    />
                  ) : (
                    <span
                      data-testid={`micro-week-bar-${day.dayKey}`}
                      className="w-full max-w-[22px] rounded-md rounded-b-none"
                      style={{
                        height: `${Math.max(
                          2,
                          ((day.value ?? 0) / nutrient.chartMax) * 100
                        )}%`,
                        backgroundColor: dayOver ? OVER : style.color,
                        opacity:
                          day.isToday || day.inTarget || active ? 1 : 0.55,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-1.5 flex justify-between gap-1.5">
          {nutrient.days.map((day) => (
            <span
              key={day.dayKey}
              className={cn(
                "flex-1 text-center text-[11px]",
                day.isToday || day.dayKey === selectedDayKey
                  ? "font-semibold text-foreground"
                  : day.value === null
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground"
              )}
            >
              {day.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tap read-out: that day's real amount for the selected nutrient. */}
      {selectedDay ? (
        <ChartReadout
          label={selectedDay.longLabel}
          primary={
            selectedDay.value === null
              ? "Nema dovoljno podataka"
              : `${formatMicroAmount(selectedDay.value, unit)} · ${labelSr.toLowerCase()}`
          }
          secondary={daySecondary(selectedDay, nutrient)}
          accentColor={
            selectedDay.value !== null && kind === "limit" && !selectedDay.inTarget
              ? OVER
              : undefined
          }
          onClear={() => onSelectDay(selectedDay.dayKey)}
          testId="micro-week-readout"
        />
      ) : (
        <ChartHint testId="micro-week-hint">
          Dodirni stubić da vidiš tačnu vrednost tog dana.
        </ChartHint>
      )}

      {/* Footer: how the week went + an honest word about missing days */}
      <p
        data-testid="micro-week-footer"
        className="text-center text-[11px] leading-snug text-muted-foreground"
      >
        {nutrient.daysWithData > 0 ? (
          <>
            {nutrient.daysInTarget} od {nutrient.daysWithData}{" "}
            {nutrient.daysWithData === 1 ? "izmerenog dana" : "izmerenih dana"}{" "}
            {kind === "goal" ? "u cilju" : "u granici"}.
          </>
        ) : (
          <>Nijedan dan ove nedelje nema dovoljno podataka.</>
        )}
        {nutrient.daysWithoutData > 0 ? (
          <>
            {" "}
            Za {nutrient.daysWithoutData}{" "}
            {nutrient.daysWithoutData === 1 ? "dan" : "dana"} nemamo dovoljno
            podataka pa ih ne računamo.
          </>
        ) : null}
      </p>
    </>
  );
}

/**
 * The read-out's second line for one day: how it sat against the target, or --
 * when we couldn't measure it -- how much of that day we actually know about.
 * Saying "podaci pokrivaju 30% dana" is the honest version of a missing bar.
 */
function daySecondary(day: MicroWeekDay, nutrient: MicroNutrientWeek): string {
  const { unit, kind } = nutrient.spec;
  if (day.value === null) {
    return day.coverage > 0
      ? `Podaci pokrivaju samo ~${Math.round(day.coverage * 100)}% tog dana, pa ga ne računamo.`
      : "Za taj dan nemamo podatke o ovom nutrijentu.";
  }
  const diff = Math.abs(day.value - nutrient.target);
  if (kind === "goal") {
    return day.inTarget
      ? `Cilj (${formatMicroAmount(nutrient.target, unit)}) ispunjen 🎉`
      : `Fali ${formatMicroAmount(diff, unit)} do cilja ${formatMicroAmount(nutrient.target, unit)}`;
  }
  return day.inTarget
    ? `Ispod granice (${formatMicroAmount(nutrient.target, unit)})`
    : `${formatMicroAmount(diff, unit)} preko granice ${formatMicroAmount(nutrient.target, unit)}`;
}

/** One plain Serbian sentence about where the week's average landed. */
function statusSentence(nutrient: MicroNutrientWeek): string {
  const { unit, labelSr } = nutrient.spec;
  const average = nutrient.average;
  if (average === null) {
    return `Još nemamo dovoljno podataka za ${labelSr.toLowerCase()}.`;
  }
  const diff = Math.abs(average - nutrient.target);
  switch (nutrient.status) {
    case "ok":
      return nutrient.spec.kind === "goal"
        ? "U proseku dostižeš dnevni cilj — samo tako. 🎉"
        : "U proseku si ispod dnevne granice.";
    case "under":
      return `U proseku ti fali ${formatMicroAmount(diff, unit)} dnevno do cilja.`;
    case "over":
      return `U proseku ${formatMicroAmount(diff, unit)} dnevno preko granice.`;
    default:
      return "";
  }
}

function Header() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
      >
        <Wheat className="size-4" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">Mikronutrijenti</h2>
      <span className="ml-auto text-xs text-muted-foreground">7 dana</span>
    </div>
  );
}
