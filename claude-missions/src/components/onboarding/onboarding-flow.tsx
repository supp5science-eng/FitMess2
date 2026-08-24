"use client";

import { useEffect, useState } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { CommitScreen } from "@/components/onboarding/commit-screen";
import { NameScreen } from "@/components/onboarding/name-screen";
import { FinishAndRedirect } from "@/components/onboarding/finish-and-redirect";
import { PlanReveal } from "@/components/onboarding/plan-reveal";
import { recordOnboardingStep } from "@/lib/funnel/record";
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
 *     questionnaire didn't ask), then writes everything (name included) to the
 *     account and goes straight to `/danas` (`FinishAndRedirect`). It does NOT
 *     replay the "računamo tvoj plan" reveal — that already played once at the
 *     end of the `/upitnik` questionnaire, so a second time would be redundant.
 *   - Fallback: no stored answers (a user who registered directly, or via
 *     Google, without doing `/upitnik` first) — we run the questionnaire here,
 *     then the commit pledge, then the name screen, then the ANIMATED plan
 *     reveal, since these users never saw it on `/upitnik`. So they get their
 *     plan exactly once, right before entering the app.
 *
 * Either way the name screen re-stashes the merged answers before the persist
 * so nothing is lost if the write needs a retry after a reload.
 *
 * `alreadyRevealed` is what decides between the two finishes: true (hand-off,
 * preview already played on `/upitnik`) → straight-to-app `FinishAndRedirect`
 * with no re-animation; false (fallback, first time) → animated `PlanReveal`.
 */
type Stage =
  | { kind: "loading" }
  | { kind: "wizard" }
  | { kind: "commit"; data: CompleteOnboardingData; alreadyRevealed: boolean }
  | { kind: "name"; data: CompleteOnboardingData; alreadyRevealed: boolean }
  | { kind: "plan"; data: CompleteOnboardingData; alreadyRevealed: boolean };

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
    // Stashed answers came from `/upitnik`, where the plan reveal already
    // played — so these hand-off users are `alreadyRevealed: true`.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: browser-only read resolved once, post-hydration (see above).
    setStage(
      pending
        ? pending.name !== null
          ? { kind: "plan", data: pending, alreadyRevealed: true }
          : { kind: "name", data: pending, alreadyRevealed: true }
        : { kind: "wizard" }
    );
  }, []);

  function handleWizardComplete(data: OnboardingData) {
    if (isOnboardingDataComplete(data)) {
      // Fallback (no `/upitnik`): the reveal hasn't been shown yet.
      setStage({ kind: "commit", data, alreadyRevealed: false });
    }
  }

  function handleNameSubmit(
    data: CompleteOnboardingData,
    name: string,
    alreadyRevealed: boolean
  ) {
    const merged: CompleteOnboardingData = { ...data, name };
    // Re-stash with the name so a reload between here and a landed persist
    // resumes at the plan instead of asking for the name again.
    savePendingOnboarding(merged);
    // Straight from the name into the plan reveal. There used to be a
    // light/dark choice between the two; the app has one theme now, so the
    // step was removed rather than left asking a question with one answer.
    setStage({ kind: "plan", data: merged, alreadyRevealed });
  }

  if (stage.kind === "commit") {
    return (
      <CommitScreen
        data={stage.data}
        onCommitted={() =>
          setStage({
            kind: "name",
            data: stage.data,
            alreadyRevealed: stage.alreadyRevealed,
          })
        }
      />
    );
  }

  if (stage.kind === "name") {
    return (
      <NameScreen
        onSubmit={(name) =>
          handleNameSubmit(stage.data, name, stage.alreadyRevealed)
        }
      />
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
    // Hand-off users already saw "računamo tvoj plan" on `/upitnik` — don't
    // replay it; write and go straight into the app. Fallback users (direct /
    // Google signup) never saw it, so they get the animated reveal once here.
    return stage.alreadyRevealed ? (
      <FinishAndRedirect data={stage.data} />
    ) : (
      <PlanReveal data={stage.data} mode="persist" />
    );
  }

  // Only the signed-in flow measures: this is the wizard where 14 of 27
  // verified accounts were lost without us being able to say at which
  // question (see 0028). The public copy on `/upitnik` has no account to
  // attribute a step to and passes nothing.
  return (
    <OnboardingWizard
      onComplete={handleWizardComplete}
      onStepShown={recordOnboardingStep}
    />
  );
}
