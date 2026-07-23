"use client";

import { useEffect, useState } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { CommitScreen } from "@/components/onboarding/commit-screen";
import { NameScreen } from "@/components/onboarding/name-screen";
import { PlanReveal } from "@/components/onboarding/plan-reveal";
import { isOnboardingDataComplete } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import type { OnboardingData } from "@/lib/onboarding/types";
import {
  readCompletePendingOnboarding,
  savePendingOnboarding,
} from "@/lib/onboarding/storage";

/**
 * The post-auth `/onboarding` flow. A verified-but-not-yet-onboarded user is
 * redirected here right after signing in / verifying their email (see
 * `src/lib/auth/route-protection.ts`).
 *
 * Onboarding now runs pre-auth on the public `/upitnik` route — and stays
 * anonymous there (no name question). Most users therefore arrive here having
 * already answered the questionnaire and seen their plan, with the answers
 * waiting in `localStorage`. Two paths:
 *
 *   - Hand-off (the common case): stored answers exist. The app "wakes up"
 *     with the smooth "Kako da te zovemo?" screen (the one thing the
 *     questionnaire didn't ask), then flows straight into the plan reveal in
 *     `persist` mode — it writes everything (name included) to the account
 *     and continues to `/danas`, replaying the reveal as a confirmation that
 *     now greets them by name.
 *   - Fallback: no stored answers (a user who registered directly, or via
 *     Google, without doing `/upitnik` first) — we run the questionnaire
 *     here, then the commit pledge, then the same name screen, then persist.
 *
 * Either way the name screen re-stashes the merged answers before the persist
 * so nothing is lost if the write needs a retry after a reload.
 */
type Stage =
  | { kind: "loading" }
  | { kind: "wizard" }
  | { kind: "commit"; data: CompleteOnboardingData }
  | { kind: "name"; data: CompleteOnboardingData }
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
    // A name in the stash means it was already asked (e.g. the persist failed
    // and the user reloaded) — skip straight to the plan instead of asking
    // again.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: browser-only read resolved once, post-hydration (see above).
    setStage(
      pending
        ? pending.name !== null
          ? { kind: "plan", data: pending }
          : { kind: "name", data: pending }
        : { kind: "wizard" }
    );
  }, []);

  function handleWizardComplete(data: OnboardingData) {
    if (isOnboardingDataComplete(data)) {
      setStage({ kind: "commit", data });
    }
  }

  function handleNameSubmit(data: CompleteOnboardingData, name: string) {
    const merged: CompleteOnboardingData = { ...data, name };
    // Re-stash with the name so a reload between here and a landed persist
    // resumes at the plan instead of asking for the name again.
    savePendingOnboarding(merged);
    setStage({ kind: "plan", data: merged });
  }

  if (stage.kind === "commit") {
    return (
      <CommitScreen
        data={stage.data}
        onCommitted={() => setStage({ kind: "name", data: stage.data })}
      />
    );
  }

  if (stage.kind === "name") {
    return (
      <NameScreen onSubmit={(name) => handleNameSubmit(stage.data, name)} />
    );
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
