"use client";

import { useEffect, useMemo, useState } from "react";

import type { GoalType } from "@/lib/types/db";
import { RulerPicker } from "@/components/onboarding/ruler-picker";
import { UnitToggle } from "@/components/onboarding/unit-toggle";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { kgToLbs } from "@/lib/onboarding/units";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "@/lib/onboarding/validation";

/**
 * The target-weight wheel only offers values that make sense for the chosen
 * goal, so an invalid target can't even be picked: for `gain` only weights
 * ABOVE the current weight, for `lose` only weights BELOW it. Falls back to
 * the full range if the current weight is somehow unknown (defensive — the
 * weight step always runs before this one).
 */
function targetWeightOptions(
  isGain: boolean,
  currentWeightKg: number | null
): number[] {
  if (currentWeightKg === null || Number.isNaN(currentWeightKg)) {
    return rangeInclusive(MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  }
  const current = Math.round(currentWeightKg);
  if (isGain) {
    return rangeInclusive(Math.max(MIN_WEIGHT_KG, current + 1), MAX_WEIGHT_KG);
  }
  return rangeInclusive(MIN_WEIGHT_KG, Math.min(MAX_WEIGHT_KG, current - 1));
}

/** A sensible starting target ~5 kg from current, clamped into the valid
 * range, so the ruler opens on a real answer instead of nothing. */
function defaultTarget(
  isGain: boolean,
  currentWeightKg: number,
  options: number[]
): number {
  const wanted = Math.round(isGain ? currentWeightKg + 5 : currentWeightKg - 5);
  if (options.includes(wanted)) return wanted;
  // Nearest offered option to the wanted value.
  return options.reduce(
    (best, o) => (Math.abs(o - wanted) < Math.abs(best - wanted) ? o : best),
    options[0]
  );
}

type WeightUnit = "kg" | "lbs";

/**
 * The `cilj` step — AS-019: collects the TARGET weight (kg) via an inline
 * ruler picker (Cal-AI look, same component as the current-weight step). The
 * timeframe is no longer picked here; a later `tempo`/pace step derives it.
 * A display-only kg/lbs toggle can change the readout; the stored value stays
 * metric.
 */
export function GoalStep({
  goal,
  currentWeightKg,
  targetWeightKg,
  onChangeTargetWeight,
  error,
}: {
  goal: GoalType;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  onChangeTargetWeight: (value: number | null) => void;
  error?: string;
}) {
  const isGain = goal === "gain";
  const [unit, setUnit] = useState<WeightUnit>("kg");

  const targetOptions = useMemo(
    () => targetWeightOptions(isGain, currentWeightKg),
    [isGain, currentWeightKg]
  );

  // Open on a real default so the ruler never sits on "nothing" and the user
  // can advance without scrolling. Runs once per (goal, current weight).
  useEffect(() => {
    if (targetWeightKg !== null) return;
    if (currentWeightKg === null || Number.isNaN(currentWeightKg)) return;
    if (targetOptions.length === 0) return;
    onChangeTargetWeight(defaultTarget(isGain, currentWeightKg, targetOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time seed; re-running on onChange/target identity would loop.
  }, [isGain, currentWeightKg, targetOptions]);

  const deltaKg =
    currentWeightKg !== null &&
    targetWeightKg !== null &&
    !Number.isNaN(currentWeightKg) &&
    !Number.isNaN(targetWeightKg)
      ? Math.round(Math.abs(currentWeightKg - targetWeightKg) * 10) / 10
      : null;

  const showDelta =
    deltaKg !== null &&
    deltaKg > 0 &&
    (isGain
      ? targetWeightKg! > currentWeightKg!
      : targetWeightKg! < currentWeightKg!);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {isGain ? "Do koje težine želiš?" : "Koja ti je ciljna težina?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Ovo je težina koju želiš da dostigneš.
        </p>
      </div>
      <UnitToggle
        ariaLabel="Jedinica za ciljnu težinu"
        options={[
          { value: "lbs", label: "lbs" },
          { value: "kg", label: "kg" },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <RulerPicker
        id="ciljna-tezina"
        label="Ciljna težina"
        caption="Ciljna težina"
        value={targetWeightKg}
        onChange={onChangeTargetWeight}
        options={targetOptions}
        renderReadout={(v) => (unit === "kg" ? `${v} kg` : `${kgToLbs(v)} lbs`)}
        error={error}
        autoFocus
      />
      {showDelta ? (
        <p
          data-testid="goal-preview"
          className="text-center text-lg font-bold text-primary"
        >
          {isGain ? "+" : "-"}
          {deltaKg} kg
        </p>
      ) : null}
    </div>
  );
}
