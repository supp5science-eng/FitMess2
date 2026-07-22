"use client";

import { useEffect, useState } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PlanReveal } from "@/components/onboarding/plan-reveal";
import { isOnboardingDataComplete } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";
import { readCompletePendingOnboarding } from "@/lib/onboarding/storage";

/**
 * The post-auth `/onboarding` flow. A verified-but-not-yet-onboarded user is
 * redirected here right after signing in / verifying their email (see
 * `src/lib/auth/route-protection.ts`).
 *
 * Onboarding now runs pre-auth on the public `/upitnik` route, so most users
 * arrive here having ALREADY answered the questionnaire and seen their plan —
 * their answers are waiting in `localStorage`. Two paths:
 *
 *   - Hand-off (the common case): stored answers exist, so we skip straight to
 *     the plan reveal in `persist` mode — it writes them to the account and
 *     continues to `/danas`, replaying the reveal as a nice confirmation.
 *   - Fallback: no stored answers (a user who registered directly, or via
 *     Google, without doing `/upitnik` first) — we run the questionnaire here,
 *     then persist.
 *
 * The `welcome` and `theme-choice` stages of the old flow are gone: the
 * questionnaire is no longer the first thing a signed-in user sees, and the
 * theme step was dropped per product direction.
 */
type Stage =
  | { kind: "loading" }
  | { kind: "wizard" }
  | { kind: "plan"; data: CompleteOnboardingData };

export function OnboardingFlow() {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  // On mount, look for answers stashed by the pre-auth `/upitnik` flow. This
  // MUST run post-hydration in an effect (not a lazy `useState` initializer):
  // `localStorage` doesn't exist during SSR, so a lazy initializer would read
  // `null` on the server and the real value on the client, tripping a
  // hydration mismatch. Starting from `loading` and resolving here keeps the
  // server and first client render identical.
  useEffect(() => {
    const pending = readCompletePendingOnboarding();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: browser-only read resolved once, post-hydration (see above).
    setStage(pending ? { kind: "plan", data: pending } : { kind: "wizard" });
  }, []);

  function handleWizardComplete(data: OnboardingData) {
    if (isOnboardingDataComplete(data)) {
      setStage({ kind: "plan", data });
    }
  }

  if (stage.kind === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center" aria-hidden="true">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </main>
    );
  }

  if (stage.kind === "plan") {
    return <PlanReveal data={stage.data} mode="persist" />;
  }

  return <OnboardingWizard onComplete={handleWizardComplete} />;
}
