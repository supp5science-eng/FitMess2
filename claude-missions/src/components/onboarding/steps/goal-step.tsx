"use client";

import { useMemo } from "react";

import type { GoalType } from "@/lib/types/db";
import { FieldError } from "@/components/onboarding/field-error";
import {
  SelectField,
  rangeInclusive,
} from "@/components/onboarding/select-field";
import {
  MAX_TIMEFRAME_WEEKS,
  MAX_WEIGHT_KG,
  MIN_TIMEFRAME_WEEKS,
  MIN_WEIGHT_KG,
} from "@/lib/onboarding/validation";

const WEEK_OPTIONS = rangeInclusive(MIN_TIMEFRAME_WEEKS, MAX_TIMEFRAME_WEEKS);

/**
 * The target-weight wheel only offers values that make sense for the chosen
 * goal, so an invalid target can't even be picked (not just rejected on
 * "Dalje"): for `gain` only weights ABOVE the current weight, for `lose` only
 * weights BELOW it. Falls back to the full range if the current weight is
 * somehow unknown (defensive -- step 4 always runs before this one).
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

function weekWord(weeks: number): string {
  if (weeks === 1) return "nedelju";
  if (weeks >= 2 && weeks <= 4) return "nedelje";
  return "nedelja";
}

/** F015 step 6 (cilj) -- AS-019: collects target weight (kg) + timeframe
 * (weeks) together, per the clarified spec's single "cilj" step. Shows a
 * big-friendly-number live preview (e.g. "-6 kg za 12 nedelja") once both
 * fields plus the current weight (step 4) are known -- Cal AI-style
 * aesthetic per the clarified spec. */
export function GoalStep({
  goal,
  currentWeightKg,
  targetWeightKg,
  timeframeWeeks,
  onChangeTargetWeight,
  onChangeTimeframe,
  error,
}: {
  goal: GoalType;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
  onChangeTargetWeight: (value: number | null) => void;
  onChangeTimeframe: (value: number | null) => void;
  error?: string;
}) {
  const isGain = goal === "gain";

  const targetOptions = useMemo(
    () => targetWeightOptions(isGain, currentWeightKg),
    [isGain, currentWeightKg]
  );

  const numbersReady =
    currentWeightKg !== null &&
    targetWeightKg !== null &&
    timeframeWeeks !== null &&
    !Number.isNaN(currentWeightKg) &&
    !Number.isNaN(targetWeightKg) &&
    !Number.isNaN(timeframeWeeks) &&
    timeframeWeeks > 0;

  // Preview only when the target sits on the correct side of current weight
  // for the chosen goal (below for lose, above for gain).
  const canPreview =
    numbersReady &&
    (isGain
      ? targetWeightKg! > currentWeightKg!
      : targetWeightKg! < currentWeightKg!);

  const deltaKg = canPreview
    ? Math.round(Math.abs(currentWeightKg! - targetWeightKg!) * 10) / 10
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {isGain ? "Do koje težine?" : "Koja ti je ciljna težina?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isGain
            ? "Izaberi željenu težinu i rok u kojem želiš da je dostigneš."
            : "Izaberi ciljnu težinu i rok u kojem želiš da je dostigneš."}
        </p>
      </div>
      <SelectField
        id="ciljna-tezina"
        label="Ciljna težina"
        suffix="kg"
        value={targetWeightKg}
        onChange={onChangeTargetWeight}
        options={targetOptions}
        placeholder="Izaberi ciljnu težinu"
        autoFocus
      />
      <SelectField
        id="nedelje"
        label="Rok"
        suffix="nedelja"
        value={timeframeWeeks}
        onChange={onChangeTimeframe}
        options={WEEK_OPTIONS}
        placeholder="Izaberi rok"
      />
      <FieldError message={error} />
      {canPreview ? (
        <p
          data-testid="goal-preview"
          className="text-2xl font-bold text-primary"
        >
          {isGain ? "+" : "-"}
          {deltaKg} kg za {timeframeWeeks} {weekWord(timeframeWeeks!)}
        </p>
      ) : null}
    </div>
  );
}
