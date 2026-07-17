"use client";

import { NumberField } from "@/components/onboarding/number-field";
import { FieldError } from "@/components/onboarding/field-error";

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
  currentWeightKg,
  targetWeightKg,
  timeframeWeeks,
  onChangeTargetWeight,
  onChangeTimeframe,
  error,
}: {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
  onChangeTargetWeight: (value: number | null) => void;
  onChangeTimeframe: (value: number | null) => void;
  error?: string;
}) {
  const canPreview =
    currentWeightKg !== null &&
    targetWeightKg !== null &&
    timeframeWeeks !== null &&
    !Number.isNaN(currentWeightKg) &&
    !Number.isNaN(targetWeightKg) &&
    !Number.isNaN(timeframeWeeks) &&
    targetWeightKg < currentWeightKg &&
    timeframeWeeks > 0;

  const deltaKg = canPreview
    ? Math.round((currentWeightKg! - targetWeightKg!) * 10) / 10
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koji je tvoj cilj?
        </h2>
        <p className="text-sm text-muted-foreground">
          Unesi ciljnu težinu i rok u kojem želiš da je dostigneš.
        </p>
      </div>
      <NumberField
        id="ciljna-tezina"
        label="Ciljna težina"
        suffix="kg"
        value={targetWeightKg}
        onChange={onChangeTargetWeight}
        step={0.1}
        autoFocus
      />
      <NumberField
        id="nedelje"
        label="Rok"
        suffix="nedelja"
        value={timeframeWeeks}
        onChange={onChangeTimeframe}
      />
      <FieldError message={error} />
      {canPreview ? (
        <p
          data-testid="goal-preview"
          className="text-2xl font-bold text-primary"
        >
          -{deltaKg} kg za {timeframeWeeks} {weekWord(timeframeWeeks!)}
        </p>
      ) : null}
    </div>
  );
}
