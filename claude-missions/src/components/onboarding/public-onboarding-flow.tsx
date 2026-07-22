"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PlanReveal } from "@/components/onboarding/plan-reveal";
import { isOnboardingDataComplete } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";
import { savePendingOnboarding } from "@/lib/onboarding/storage";

/**
 * The PUBLIC, pre-auth onboarding flow at `/upitnik` (Cal-AI-style): a
 * brand-new visitor answers the questionnaire and sees their computed plan
 * WITHOUT an account. Only when they tap "napravi nalog i sačuvaj" do we send
 * them to registration.
 *
 * There's no session yet, so nothing is written to Supabase here — the answers
 * are stashed in `localStorage` (`savePendingOnboarding`) so they survive
 * registration + email verification, and the post-auth `/onboarding` flow
 * (`onboarding-flow.tsx`) picks them back up and persists them once a session
 * exists.
 */
type Stage =
  | { kind: "wizard" }
  | { kind: "plan"; data: CompleteOnboardingData };

export function PublicOnboardingFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "wizard" });

  function handleWizardComplete(data: OnboardingData) {
    if (!isOnboardingDataComplete(data)) return;
    // Stash immediately so the answers can't be lost between the plan preview
    // and finishing registration.
    savePendingOnboarding(data);
    setStage({ kind: "plan", data });
  }

  function goToRegistration() {
    if (stage.kind === "plan") {
      // Belt and braces: re-stash right before we leave for the auth flow.
      savePendingOnboarding(stage.data);
    }
    router.push("/registracija");
  }

  if (stage.kind === "plan") {
    return (
      <PlanReveal data={stage.data} mode="preview" onContinue={goToRegistration} />
    );
  }

  return <OnboardingWizard onComplete={handleWizardComplete} />;
}
