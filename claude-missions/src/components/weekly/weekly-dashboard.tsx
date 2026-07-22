import type { ReactNode } from "react";

import { BmiCard } from "@/components/analytics/bmi-card";
import { IntakeTrendCard } from "@/components/analytics/intake-trend-card";
import { MacroAverageCard } from "@/components/analytics/macro-average-card";
import type { IntakeTrend } from "@/lib/weight/intake-trend";
import type { MacroWeek } from "@/lib/week/macro-weeks";

// F041: the Analitika dashboard body. Presentational: the page owns every
// server data read and hands down fully-derived props; this component only lays
// out the cards. sr-Latn, informal "ti", zero-shame tone throughout.
export function WeeklyDashboard({
  bmi,
  macroWeeks,
  intakeTrend,
  weightSection,
  footer,
}: {
  /** The user's body-mass index (kg/m²), computed from their questionnaire
   * height + weight by the page. `null` when either is missing -- the card
   * then shows a calm "dopuni profil" state instead of a number. */
  bmi: number | null;
  /** Per-week macro-stacked summaries (index 0 = this week) for the "Dnevni
   * prosek kalorija" card, computed server-side by `computeMacroWeeks`. */
  macroWeeks: MacroWeek[];
  /** Estimated 7-day weight trend from calorie intake (`computeIntakeTrend`).
   * `null` when TDEE or current weight can't be derived -- the card then shows
   * a calm "dopuni profil" state. */
  intakeTrend: IntakeTrend | null;
  /** F042/F043: the "Težina" section, rendered between the chart and the
   * meal-history footer. Passed as a node (like `footer`) so the page owns the
   * server data read and this component stays presentational. */
  weightSection?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analitika
        </h1>
        <p className="text-sm text-muted-foreground">Ova nedelja</p>
      </header>

      {/* BMI from the questionnaire height + weight. */}
      <BmiCard bmi={bmi} />

      {/* Daily average calories + macro-stacked per-day chart + week selector. */}
      <MacroAverageCard weeks={macroWeeks} />

      {/* Estimated weight trend from calorie intake (energy balance + macros). */}
      <IntakeTrendCard trend={intakeTrend} />

      {/* F042/F043: weight + trend (real weigh-ins) */}
      {weightSection}

      {/* "Svi obroci" meal-history log (bottom of the page) */}
      {footer}
    </main>
  );
}
