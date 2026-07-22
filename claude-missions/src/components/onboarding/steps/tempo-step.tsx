"use client";

import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_PACE,
  PACE_DESCRIPTIONS,
  PACE_LABELS,
  PACE_ORDER,
  PACE_WEEKLY_KG,
  formatTimeToGoal,
  paceColor,
  timeframeWeeksForPace,
  type WeightChangePace,
} from "@/lib/onboarding/pace";
import { PaceSlider } from "@/components/onboarding/pace-slider";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";

/** Emoji marker per pace (sloth → rabbit → cheetah), matching the reference. */
const PACE_ICON: Record<WeightChangePace, string> = {
  slow: "🦥",
  recommended: "🐇",
  fast: "🐆",
};

function kgReadout(kg: number): string {
  // 0.5 -> "0,5" (Serbian decimal comma), 1 -> "1".
  return kg.toLocaleString("sr-RS", { maximumFractionDigits: 2 });
}

/**
 * The `tempo` step — the questionnaire's last question for weight-change
 * goals: "how fast do you want to reach your goal?" An interactive slider
 * over slow / recommended / fast. The pace is a target weekly weight change;
 * from it + the target delta we DERIVE the timeframe in weeks (pushed up via
 * `onChangeTimeframe`, so the budget engine + DB consume it unchanged) and
 * show a live "reach your goal in ~N" + daily-calorie preview that updates as
 * the user drags. A short explanation of the selected pace is always shown.
 */
export function TempoStep({
  data,
  onChangePace,
  onChangeTimeframe,
}: {
  data: OnboardingData;
  onChangePace: (pace: WeightChangePace) => void;
  onChangeTimeframe: (weeks: number | null) => void;
}) {
  const pace: WeightChangePace = data.pace ?? DEFAULT_PACE;
  const color = paceColor(pace);

  const deltaKg =
    data.weightKg !== null &&
    data.targetWeightKg !== null &&
    !Number.isNaN(data.weightKg) &&
    !Number.isNaN(data.targetWeightKg)
      ? Math.abs(data.weightKg - data.targetWeightKg)
      : null;

  const timeframeWeeks =
    deltaKg !== null ? timeframeWeeksForPace(deltaKg, pace) : null;

  // Keep the derived timeframe in the collected data so everything downstream
  // (completion check, budget engine, persist → `targets.timeframe_weeks`)
  // sees the pace's effect. Runs whenever the pace or the delta changes.
  useEffect(() => {
    if (timeframeWeeks !== null && timeframeWeeks !== data.timeframeWeeks) {
      onChangeTimeframe(timeframeWeeks);
    }
  }, [timeframeWeeks, data.timeframeWeeks, onChangeTimeframe]);

  // Live daily-calorie target for the currently-selected pace. Recomputed
  // through the same budget engine the plan reveal uses, so the number the
  // user sees here is exactly what they'll get.
  const dailyKcal = useMemo(() => {
    if (
      timeframeWeeks === null ||
      data.sex === null ||
      data.ageYears === null ||
      data.heightCm === null ||
      data.weightKg === null ||
      data.activityLevel === null ||
      data.goal === null ||
      data.targetWeightKg === null
    ) {
      return null;
    }
    return computeBudgetSummary({
      name: data.name ?? "",
      sex: data.sex,
      ageYears: data.ageYears,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      activityLevel: data.activityLevel,
      goal: data.goal,
      targetWeightKg: data.targetWeightKg,
      pace,
      timeframeWeeks,
    }).dailyKcal;
  }, [
    pace,
    timeframeWeeks,
    data.name,
    data.sex,
    data.ageYears,
    data.heightCm,
    data.weightKg,
    data.activityLevel,
    data.goal,
    data.targetWeightKg,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koliko brzo želiš da stigneš do cilja?
        </h2>
        <p className="text-sm text-muted-foreground">
          Od ovoga zavisi tvoj dnevni unos kalorija.
        </p>
      </div>

      {/* Big readout: weekly rate for the selected pace, tinted by pace */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm text-muted-foreground">
          Promena težine nedeljno
        </span>
        <span
          className="text-5xl font-bold tracking-tight transition-colors duration-200"
          style={{ color }}
        >
          {kgReadout(PACE_WEEKLY_KG[pace])} kg
        </span>
      </div>

      {/* Tappable pace markers */}
      <div className="grid grid-cols-3 gap-2">
        {PACE_ORDER.map((p) => {
          const active = p === pace;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChangePace(p)}
              aria-pressed={active}
              className="flex flex-col items-center gap-1 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "text-2xl leading-none transition-all duration-200",
                  active ? "scale-110" : "opacity-45 grayscale"
                )}
                aria-hidden
              >
                {PACE_ICON[p]}
              </span>
              <span
                className="text-sm font-semibold transition-colors duration-200"
                style={{ color: active ? paceColor(p) : undefined }}
              >
                {PACE_LABELS[p]}
              </span>
            </button>
          );
        })}
      </div>

      {/* The smooth, colorful slider */}
      <PaceSlider value={pace} onChange={onChangePace} />

      {/* Live plan preview for the selected pace */}
      <div
        className="rounded-2xl border p-4 transition-colors duration-200"
        style={{
          borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
          background: `color-mix(in srgb, ${color} 8%, transparent)`,
        }}
      >
        {timeframeWeeks !== null ? (
          <p className="text-base font-semibold text-foreground">
            Cilj dostižeš za{" "}
            <span style={{ color }}>~{formatTimeToGoal(timeframeWeeks)}</span>
          </p>
        ) : null}
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {PACE_DESCRIPTIONS[pace]}
        </p>
        {dailyKcal !== null ? (
          <p
            className="mt-2 text-sm text-muted-foreground"
            data-testid="tempo-daily-kcal"
          >
            Dnevni unos:{" "}
            <b className="text-foreground">
              {dailyKcal.toLocaleString("sr-RS")} kcal
            </b>
          </p>
        ) : null}
      </div>
    </div>
  );
}
