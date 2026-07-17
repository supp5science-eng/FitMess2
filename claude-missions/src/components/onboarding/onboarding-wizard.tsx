"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { SexStep } from "@/components/onboarding/steps/sex-step";
import { AgeStep } from "@/components/onboarding/steps/age-step";
import { HeightStep } from "@/components/onboarding/steps/height-step";
import { WeightStep } from "@/components/onboarding/steps/weight-step";
import { ActivityStep } from "@/components/onboarding/steps/activity-step";
import { GoalStep } from "@/components/onboarding/steps/goal-step";
import {
  buildOnboardingSummaryUrl,
  EMPTY_ONBOARDING_DATA,
  ONBOARDING_STEP_IDS,
} from "@/lib/onboarding/types";
import type {
  OnboardingData,
  OnboardingStepId,
} from "@/lib/onboarding/types";
import {
  validateActivityLevel,
  validateAge,
  validateGoal,
  validateHeight,
  validateSex,
  validateWeight,
} from "@/lib/onboarding/validation";
import type { ValidationResult } from "@/lib/onboarding/validation";

const TOTAL_STEPS = ONBOARDING_STEP_IDS.length;

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
    case "cilj":
      return validateGoal(
        data.targetWeightKg,
        data.timeframeWeeks,
        data.weightKg
      );
    default:
      return { valid: true };
  }
}

/**
 * F015: the onboarding wizard (AS-018, AS-019). One question per screen,
 * Serbian (ti-form) copy, a progress indicator, and inline Serbian
 * validation. All collected state lives here in client state (React
 * `useState`) -- per the clarified spec's "URL step param or client state"
 * option, client state was chosen since this component never unmounts
 * between steps (only which step's JSX renders changes), so nothing is
 * lost moving Back/Dalje (see the F015 handoff's "Decisions made").
 *
 * On the final step, hands the fully-collected data off to F016's summary
 * screen via the query string (`buildOnboardingSummaryUrl`) -- this
 * feature never writes to the database and never sets `onboarded_at`
 * itself, per the clarified scope ("do not implement the final save
 * here").
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(EMPTY_ONBOARDING_DATA);
  const [error, setError] = useState<string | undefined>(undefined);

  const stepId = ONBOARDING_STEP_IDS[stepIndex];
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  function update<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    // Clear a stale error the moment the user edits the field again, rather
    // than leaving last step's rejected message on screen while they type
    // a new value.
    setError(undefined);
  }

  function handleBack() {
    setError(undefined);
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function handleNext() {
    const result = validateStep(stepId, data);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(undefined);

    if (isLastStep) {
      router.push(buildOnboardingSummaryUrl(data));
      return;
    }
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <ProgressIndicator
        currentStep={stepIndex + 1}
        totalSteps={TOTAL_STEPS}
      />

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
      {stepId === "cilj" && (
        <GoalStep
          currentWeightKg={data.weightKg}
          targetWeightKg={data.targetWeightKg}
          timeframeWeeks={data.timeframeWeeks}
          onChangeTargetWeight={(value) => update("targetWeightKg", value)}
          onChangeTimeframe={(value) => update("timeframeWeeks", value)}
          error={error}
        />
      )}

      <div className="mt-auto flex items-center gap-3 pt-4">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1"
          >
            Nazad
          </Button>
        ) : null}
        <Button type="button" onClick={handleNext} className="flex-1">
          {isLastStep ? "Završi" : "Dalje"}
        </Button>
      </div>
    </div>
  );
}
