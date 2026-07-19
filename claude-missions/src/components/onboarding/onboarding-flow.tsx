"use client";

import { useState } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ThemeChoiceStep } from "@/components/onboarding/theme-choice-step";
import { WelcomeIntro } from "@/components/onboarding/welcome-intro";

/**
 * The `/onboarding` entry flow. A verified-but-not-yet-onboarded user is
 * redirected here right after signing in (see
 * `src/lib/auth/route-protection.ts`), and the first thing they should see is
 * a warm, animated welcome — never the raw questionnaire and never the app's
 * bottom navigation (this whole route is full-bleed).
 *
 * Three stages held in local state: the `WelcomeIntro` confirmation screen, a
 * one-time light/dark `ThemeChoiceStep` (offered right after sign-up), then the
 * `OnboardingWizard` itself. Keeping the gating here (rather than inside the
 * wizard) leaves `OnboardingWizard` unchanged and independently testable.
 */
type Stage = "welcome" | "theme" | "wizard";

export function OnboardingFlow() {
  const [stage, setStage] = useState<Stage>("welcome");

  if (stage === "welcome") {
    return <WelcomeIntro onStart={() => setStage("theme")} />;
  }

  if (stage === "theme") {
    return <ThemeChoiceStep onContinue={() => setStage("wizard")} />;
  }

  return <OnboardingWizard />;
}
