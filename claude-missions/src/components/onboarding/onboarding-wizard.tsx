"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { SexStep } from "@/components/onboarding/steps/sex-step";
import { AgeStep } from "@/components/onboarding/steps/age-step";
import { HeightStep } from "@/components/onboarding/steps/height-step";
import { WeightStep } from "@/components/onboarding/steps/weight-step";
import { ActivityStep } from "@/components/onboarding/steps/activity-step";
import { GoalTypeStep } from "@/components/onboarding/steps/goal-type-step";
import { GoalStep } from "@/components/onboarding/steps/goal-step";
import { TempoStep } from "@/components/onboarding/steps/tempo-step";
import {
  DEFAULT_ONBOARDING_DATA,
  visibleStepIds,
} from "@/lib/onboarding/types";
import type {
  OnboardingData,
  OnboardingStepId,
} from "@/lib/onboarding/types";
import {
  validateActivityLevel,
  validateAge,
  validateGoalType,
  validateHeight,
  validateSex,
  validateTargetWeight,
  validateWeight,
} from "@/lib/onboarding/validation";
import type { ValidationResult } from "@/lib/onboarding/validation";

/**
 * The single source of truth for "is the current step's data good enough
 * to move on" -- delegates to the pure `src/lib/onboarding/validation.ts`
 * functions (AS-019's "client-side validation with sensible ranges").
 */
function validateStep(
  stepId: OnboardingStepId,
  data: OnboardingData
): ValidationResult {
  switch (stepId) {
    case "pol":
      return validateSex(data.sex);
    case "godine":
      return validateAge(data.ageYears);
    case "visina":
      return validateHeight(data.heightCm);
    case "tezina":
      return validateWeight(data.weightKg);
    case "aktivnost":
      return validateActivityLevel(data.activityLevel);
    case "cilj-tip":
      return validateGoalType(data.goal);
    case "cilj":
      return validateTargetWeight(
        data.targetWeightKg,
        data.weightKg,
        data.goal ?? "lose"
      );
    case "tempo":
      // The pace always has a valid default and the timeframe is derived from
      // it, so this step is never blocking.
      return { valid: true };
    default:
      return { valid: true };
  }
}

/**
 * F015: the onboarding wizard (AS-018, AS-019). One question per screen,
 * Serbian (ti-form) copy, a progress indicator, and inline Serbian
 * validation.
 *
 * The set of steps is dynamic: after the goal-type step, the target-weight
 * ("cilj") step is only shown for weight-change goals (lose/gain), so
 * maintain/tone finish one step earlier (`visibleStepIds`). All collected
 * state lives here in client state; nothing is lost moving Back/Dalje.
 *
 * On the final step, hands the fully-collected data back to the parent flow
 * via `onComplete`. The parent decides what happens next — the pre-auth
 * `/upitnik` flow shows an anonymous plan preview then routes to
 * registration; the post-auth `/onboarding` flow persists and continues to
 * the dashboard. Keeping the wizard navigation-agnostic lets both reuse it
 * unchanged.
 */
export function OnboardingWizard({
  onComplete,
}: {
  onComplete: (data: OnboardingData) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_ONBOARDING_DATA);
  const [error, setError] = useState<string | undefined>(undefined);
  // Drives the slide-transition direction: forward (Dalje) enters from the
  // right, back (Nazad) from the left, so navigation has a clear sense of
  // travel. Purely cosmetic — the step content is unchanged.
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const stepIds = useMemo(() => visibleStepIds(data.goal), [data.goal]);
  const totalSteps = stepIds.length;
  // Guard against the visible-step count shrinking under the current index
  // (e.g. switching from a weight-change goal back to maintain).
  const currentIndex = Math.min(stepIndex, totalSteps - 1);
  const stepId = stepIds[currentIndex];
  const isLastStep = currentIndex === totalSteps - 1;

  function update<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    setError(undefined);
  }

  function handleBack() {
    setError(undefined);
    setDirection("back");
    setStepIndex(Math.max(0, currentIndex - 1));
  }

  function handleNext() {
    const result = validateStep(stepId, data);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(undefined);

    if (isLastStep) {
      onComplete(data);
      return;
    }
    setDirection("forward");
    setStepIndex(currentIndex + 1);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-x-clip px-6 py-8">
      <ProgressIndicator
        currentStep={currentIndex + 1}
        totalSteps={totalSteps}
      />

      {/* Keyed on the step id so each question remounts and plays its enter
          animation; the direction (Dalje / Nazad) picks the slide side. The
          whole block is `motion-safe`-gated, so reduced-motion users just see
          the next question with no travel. */}
      <div
        key={stepId}
        className={cn(
          "flex flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out",
          direction === "forward"
            ? "motion-safe:slide-in-from-right-6"
            : "motion-safe:slide-in-from-left-6"
        )}
      >
        {stepId === "pol" && (
        <SexStep
          value={data.sex}
          onChange={(value) => update("sex", value)}
          error={error}
        />
      )}
      {stepId === "godine" && (
        <AgeStep
          value={data.ageYears}
          onChange={(value) => update("ageYears", value)}
          error={error}
        />
      )}
      {stepId === "visina" && (
        <HeightStep
          value={data.heightCm}
          onChange={(value) => update("heightCm", value)}
          error={error}
        />
      )}
      {stepId === "tezina" && (
        <WeightStep
          value={data.weightKg}
          onChange={(value) => update("weightKg", value)}
          error={error}
        />
      )}
      {stepId === "aktivnost" && (
        <ActivityStep
          value={data.activityLevel}
          onChange={(value) => update("activityLevel", value)}
          error={error}
        />
      )}
      {stepId === "cilj-tip" && (
        <GoalTypeStep
          value={data.goal}
          onChange={(value) => update("goal", value)}
          error={error}
        />
      )}
      {stepId === "cilj" && (
        <GoalStep
          goal={data.goal ?? "lose"}
          currentWeightKg={data.weightKg}
          targetWeightKg={data.targetWeightKg}
          onChangeTargetWeight={(value) => update("targetWeightKg", value)}
          error={error}
        />
      )}
        {stepId === "tempo" && (
          <TempoStep
            data={data}
            onChangePace={(value) => update("pace", value)}
            onChangeTimeframe={(value) => update("timeframeWeeks", value)}
          />
        )}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-4">
        {currentIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="h-14 flex-1 rounded-full text-base font-semibold"
          >
            Nazad
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={handleNext}
          className="h-14 flex-1 rounded-full text-base font-semibold"
        >
          {isLastStep ? "Završi" : "Dalje"}
        </Button>
      </div>
    </div>
  );
}
