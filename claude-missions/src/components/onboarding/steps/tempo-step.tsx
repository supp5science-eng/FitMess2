"use client";

import { useEffect, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { PaceDial } from "@/components/onboarding/pace-dial";
import {
  PACE_DESCRIPTIONS,
  PACE_LABELS,
  DEFAULT_PACE,
  formatTimeToGoal,
  paceRingColorAt,
  paceToPosition,
  positionForTimeframe,
  positionToPace,
  timeframeWeeksForWeeklyKg,
  weeklyKgForPosition,
  type WeightChangePace,
} from "@/lib/onboarding/pace";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";

function kgReadout(kg: number): string {
  return kg.toLocaleString("sr-RS", { maximumFractionDigits: 2 });
}

/**
 * The `tempo` step — the questionnaire's last question for weight-change goals:
 * "how fast do you want to reach your goal?" A single rotary dial (`PaceDial`)
 * the user drags around a ring to pick ANY pace between the slow and fast
 * bounds; the color shifts olive-yellow → green → red as they move toward a
 * slower/faster goal. From the continuous position we DERIVE the timeframe in
 * weeks (pushed up via `onChangeTimeframe`, so the budget engine + DB consume
 * it unchanged) and mirror the nearest zone into `pace` for labeling/storage.
 * A live daily-calorie preview stays in sync with the dial.
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
  const { t } = useT();
  const deltaKg =
    data.weightKg !== null &&
    data.targetWeightKg !== null &&
    !Number.isNaN(data.weightKg) &&
    !Number.isNaN(data.targetWeightKg)
      ? Math.abs(data.weightKg - data.targetWeightKg)
      : null;

  // Restore the dial from the stored timeframe (navigating Back → forward), or
  // fall back to the saved/default pace zone the wizard opens on.
  const [position, setPosition] = useState<number>(
    () =>
      positionForTimeframe(deltaKg, data.timeframeWeeks) ??
      paceToPosition(data.pace ?? DEFAULT_PACE)
  );

  const weeklyKg = weeklyKgForPosition(position);
  const timeframeWeeks =
    deltaKg !== null ? timeframeWeeksForWeeklyKg(deltaKg, weeklyKg) : null;
  const nearestPace = positionToPace(position);
  const color = paceRingColorAt(position);

  // Keep the derived timeframe + nearest pace zone in the collected data so
  // everything downstream (completion check, budget engine, persist →
  // `targets.timeframe_weeks`) sees the dial's effect.
  useEffect(() => {
    if (timeframeWeeks !== null && timeframeWeeks !== data.timeframeWeeks) {
      onChangeTimeframe(timeframeWeeks);
    }
  }, [timeframeWeeks, data.timeframeWeeks, onChangeTimeframe]);

  useEffect(() => {
    if (nearestPace !== data.pace) onChangePace(nearestPace);
  }, [nearestPace, data.pace, onChangePace]);

  // Live daily-calorie target for the current position, through the same engine
  // the plan reveal uses. Computed from the CURRENT dial values (not the parent
  // state, which lags a render), so the preview never trails the drag.
  const dailyKcal = ((): number | null => {
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
      pace: nearestPace,
      timeframeWeeks,
    }).dailyKcal;
  })();

  const ariaValueText = `${PACE_LABELS[nearestPace]}, ${t(
    "onboarding.tempo.weeklyKg",
    { kg: kgReadout(weeklyKg) }
  )}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("onboarding.tempo.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.tempo.subtitle")}
        </p>
      </div>

      <PaceDial
        position={position}
        onPositionChange={setPosition}
        color={color}
        ariaLabel={t("onboarding.tempo.dialAria")}
        ariaValueText={ariaValueText}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[13px] font-bold uppercase tracking-wide"
            style={{ color }}
          >
            {PACE_LABELS[nearestPace]}
          </span>
          {dailyKcal !== null ? (
            <span
              className="text-3xl font-bold leading-tight"
              data-testid="tempo-daily-kcal"
              style={{ color }}
            >
              {dailyKcal.toLocaleString("sr-RS")}
            </span>
          ) : null}
          <span className="text-[12px] text-muted-foreground">
            {t("onboarding.plan.kcalPerDay")}
          </span>
          <span className="mt-1.5 text-[12px] font-medium text-foreground">
            {t("onboarding.tempo.weeklyKg", { kg: kgReadout(weeklyKg) })}
          </span>
          {timeframeWeeks !== null ? (
            <span className="text-[12px] text-muted-foreground">
              {t("onboarding.tempo.eta", {
                time: formatTimeToGoal(timeframeWeeks),
              })}
            </span>
          ) : null}
        </div>
      </PaceDial>

      {/* Calm explanation for the current zone */}
      <p className="rounded-2xl bg-muted/60 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
        {PACE_DESCRIPTIONS[nearestPace]}
      </p>
    </div>
  );
}
