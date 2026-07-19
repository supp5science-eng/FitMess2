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

interface PaceAdvice {
  severity: "warn" | "caution";
  text: string;
}

/**
 * Doctor-tone pace check based on weekly weight change as a % of current
 * bodyweight -- deliberately TDEE-free so it works with only the data this
 * step has. Clinical rules of thumb: safe fat loss is up to ~1% of bodyweight
 * per week; lean muscle gain is far slower (~0.25-0.5 kg/week, anything faster
 * is mostly fat). When the requested pace exceeds those, the budget engine
 * clamps the plan anyway (25% deficit / 20% surplus caps) -- this surfaces the
 * *why* to the user instead of silently overriding them.
 */
function paceAdvice(
  isGain: boolean,
  deltaKg: number,
  weeks: number,
  currentWeightKg: number
): PaceAdvice | null {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const weeklyKg = deltaKg / weeks;
  const weeklyPct = (weeklyKg / currentWeightKg) * 100;

  if (isGain) {
    if (weeklyPct > 0.75) {
      return {
        severity: "warn",
        text: `Tražiš oko ${round1(weeklyKg)} kg nedeljno — pri tom tempu se dobija uglavnom salo, ne mišić. Čista mišićna masa raste sporo, realno ~0.25–0.5 kg nedeljno. Produži rok za kvalitetniju masu.`,
      };
    }
    if (weeklyPct > 0.5) {
      return {
        severity: "caution",
        text: "Nešto brže nego što je optimalno za čistu masu. Sporiji suficit znači manje sala uz isti mišić.",
      };
    }
    return null;
  }

  const safeWeeklyKg = currentWeightKg * 0.01;
  const minWeeks = Math.max(1, Math.ceil(deltaKg / safeWeeklyKg));
  if (weeklyPct > 1.5) {
    return {
      severity: "warn",
      text: `Tražiš oko ${round1(weeklyKg)} kg nedeljno — to je vrlo agresivno. Bezbedan tempo je do ~1% telesne težine (oko ${round1(safeWeeklyKg)} kg) nedeljno. Ovako brzo obično se gubi i mišić, pada energija i lakše se sve vrati nazad. Za ovaj cilj realno treba bar ~${minWeeks} nedelja.`,
    };
  }
  if (weeklyPct > 1.0) {
    return {
      severity: "caution",
      text: "Malo brže nego što se preporučuje (do ~1% težine nedeljno). Izvodljivo je, ali blaži tempo se lakše održava i bolje čuva mišiće.",
    };
  }
  return null;
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

  const advice =
    canPreview && deltaKg !== null
      ? paceAdvice(isGain, deltaKg, timeframeWeeks!, currentWeightKg!)
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
      {advice ? (
        <p
          data-testid="pace-advice"
          role={advice.severity === "warn" ? "alert" : undefined}
          className={
            advice.severity === "warn"
              ? "rounded-lg border border-destructive/50 p-3 text-sm leading-relaxed text-destructive"
              : "text-sm leading-relaxed text-muted-foreground"
          }
        >
          {advice.text}
        </p>
      ) : null}
    </div>
  );
}
