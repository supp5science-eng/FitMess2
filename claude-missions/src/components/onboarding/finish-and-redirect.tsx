"use client";

import { useEffect, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { finishOnboardingAction } from "@/app/(app)/onboarding/pregled/actions";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import { clearPendingOnboarding } from "@/lib/onboarding/storage";

// One-shot flag for the post-onboarding "install FitMess" overlay on /danas
// (consumed by `components/pwa/install-overlay.tsx`).
const INSTALL_COOKIE = "fm_install";

type SaveState = "saving" | "error";

/**
 * Post-name onboarding finish — the "pravo u app" hand-off.
 *
 * The "računamo tvoj plan" reveal already played once, at the END of the
 * (pre-auth) `/upitnik` questionnaire. Replaying it here — right after the user
 * confirms their name — was redundant, so this screen DOESN'T animate: it just
 * writes everything to the account in the background behind a small spinner and
 * then goes straight to `/danas`.
 *
 * (The animated `PlanReveal` is untouched — it still runs in `preview` mode on
 * `/upitnik` and on the `/onboarding/pregled` hand-off route.)
 */
export function FinishAndRedirect({ data }: { data: CompleteOnboardingData }) {
  const { t } = useT();
  const [state, setState] = useState<SaveState>("saving");
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    finishOnboardingAction(data).then(
      (result) => {
        if (cancelled) return;
        if (result.ok) {
          // Answers now live on the account — drop the pre-auth stash.
          clearPendingOnboarding();
          try {
            // Keep the install offer, but deliberately DON'T set `fm_intro`:
            // with no plan-reveal ring to hand off, the dashboard should just
            // appear — straight into the app.
            document.cookie = `${INSTALL_COOKIE}=1; path=/; max-age=600; samesite=lax`;
          } catch {
            // No cookie -> no install offer; never blocks navigation.
          }
          // Hard navigation so the middleware re-runs against the now
          // fully-onboarded profile (onboarded_at set).
          //
          // The stop before /danas is `/onboarding/klon` -- building the avatar
          // is the first thing a brand-new account does, while the "this is
          // mine" feeling from the plan reveal is still warm. It is skippable
          // and its "Preskoči za sad" lands on /danas, so this is one screen in
          // the way, not a wall.
          window.location.assign("/onboarding/klon");
        } else {
          setError(result.error_sr);
          setState("error");
        }
      },
      () => {
        if (cancelled) return;
        setError(t("onboarding.error.generic"));
        setState("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [data, nonce, t]);

  if (state === "error") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        role="alert"
      >
        <p className="text-sm text-muted-foreground">
          {error ?? t("onboarding.error.genericShort")}
        </p>
        <Button
          type="button"
          className="h-12 rounded-full px-6 font-semibold"
          onClick={() => {
            setError(undefined);
            setState("saving");
            setNonce((n) => n + 1);
          }}
        >
          {t("onboarding.retry")}
        </Button>
      </main>
    );
  }

  return (
    <main
      className="flex flex-1 items-center justify-center"
      aria-hidden="true"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </main>
  );
}
