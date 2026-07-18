"use client";

import { useState } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { WelcomeIntro } from "@/components/onboarding/welcome-intro";

/**
 * The `/onboarding` entry flow. A verified-but-not-yet-onboarded user is
 * redirected here right after signing in (see
 * `src/lib/auth/route-protection.ts`), and the first thing they should see is
 * a warm, animated welcome — never the raw questionnaire and never the app's
 * bottom navigation (this whole route is full-bleed).
 *
 * Two stages held in local state: the `WelcomeIntro` confirmation screen, then
 * the `OnboardingWizard` itself once they tap "Započni upitnik". Keeping the
 * gate here (rather than inside the wizard) leaves `OnboardingWizard` unchanged
 * and independently testable.
 */
export function OnboardingFlow() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <WelcomeIntro onStart={() => setStarted(true)} />;
  }

  return <OnboardingWizard />;
}
