"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { SourcesLink } from "@/components/sources/sources-link";
import { finishOnboardingAction } from "@/app/(app)/onboarding/pregled/actions";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import { clearPendingOnboarding } from "@/lib/onboarding/storage";
import "./plan-reveal.css";

/**
 * The onboarding plan reveal: after the last wizard question we don't drop the
 * user on a form -- we play a short, premium "računamo tvoj plan" animation,
 * then reveal the daily kcal target with a counting ring.
 *
 * Two modes, because onboarding now spans the auth boundary (Cal-AI-style):
 *
 *  - `mode="preview"` (pre-auth, on `/upitnik`): the visitor has no account
 *    yet, so we ONLY compute + show the plan (no DB write), then surface a
 *    "napravi nalog i sačuvaj" CTA that hands control back to the parent flow
 *    (`onContinue`), which stashes the answers and routes to registration.
 *
 *  - `mode="persist"` (post-auth, on `/onboarding`): a session now exists, so
 *    the write happens in the background here (`finishOnboardingAction`, which
 *    deliberately does NOT redirect) while the animation plays; once BOTH the
 *    animation has finished and the write has landed we clear the stashed
 *    answers and hard-navigate to `/danas`. If the write fails, we surface a
 *    friendly Serbian retry instead of navigating.
 */

const CALC_MS = 2500;
const COUNT_MS = 1300;
const HOLD_MS = 1400;
const OUTRO_MS = 900;

// Shared with `/danas` (loading.tsx + HomeScreen): a short-lived cookie that
// carries the just-computed daily target across the hard navigation so the
// dashboard can play the "ring hand-off" intro (matching loading cover, then
// a ghost ring that glides into the real daily ring) with zero seam.
// One-shot flag for the post-onboarding "install FitMess" overlay on /danas
// (see `components/pwa/install-overlay.tsx`, which consumes it).
const INSTALL_COOKIE = "fm_install";

function formatKcal(n: number) {
  return n.toLocaleString("sr-RS");
}

type Phase = "calc" | "reveal";
type SaveState = "saving" | "done" | "error";
type PlanRevealMode = "preview" | "persist";

export function PlanReveal({
  data,
  mode = "persist",
  onContinue,
}: {
  data: CompleteOnboardingData;
  /** `preview` = pre-auth (compute + CTA only); `persist` = post-auth (write
   * + navigate). Defaults to `persist` to preserve the original behaviour. */
  mode?: PlanRevealMode;
  /** Called in `preview` mode when the visitor taps the save CTA. */
  onContinue?: () => void;
}) {
  const { t } = useT();
  const CALC_LINES = [
    t("onboarding.plan.calc1"),
    t("onboarding.plan.calc2"),
    t("onboarding.plan.calc3"),
    t("onboarding.plan.calc4"),
  ];
  const summary = useMemo(() => computeBudgetSummary(data), [data]);
  const target = summary.dailyKcal;

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const calcMs = reduced ? 500 : CALC_MS;
  const countMs = reduced ? 0 : COUNT_MS;
  const holdMs = reduced ? 700 : HOLD_MS;
  const outroMs = reduced ? 220 : OUTRO_MS;

  const [phase, setPhase] = useState<Phase>("calc");
  const [calcLine, setCalcLine] = useState(0);
  const [count, setCount] = useState(reduced ? target : 0);
  const [animationDone, setAnimationDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("saving");
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [saveNonce, setSaveNonce] = useState(0);

  const persist = mode === "persist";

  // Persist in the background (retried by bumping `saveNonce`). Preview mode
  // has no account to write to yet, so it skips this entirely.
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    finishOnboardingAction(data).then(
      (result) => {
        if (cancelled) return;
        if (result.ok) {
          setSaveState("done");
        } else {
          setSaveError(result.error_sr);
          setSaveState("error");
        }
      },
      () => {
        if (cancelled) return;
        setSaveError(t("onboarding.error.generic"));
        setSaveState("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [persist, data, saveNonce, t]);

  // Cycle the reassurance copy during the calc phase.
  useEffect(() => {
    if (phase !== "calc" || reduced) return;
    const id = setInterval(() => {
      setCalcLine((i) => Math.min(i + 1, CALC_LINES.length - 1));
    }, calcMs / CALC_LINES.length);
    return () => clearInterval(id);
  }, [phase, reduced, calcMs, CALC_LINES.length]);

  // calc -> reveal.
  useEffect(() => {
    const id = setTimeout(() => setPhase("reveal"), calcMs);
    return () => clearTimeout(id);
  }, [calcMs]);

  // Count the kcal up during reveal, then mark the animation done after a hold.
  useEffect(() => {
    if (phase !== "reveal") return;
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    const start = performance.now();

    const tick = (now: number) => {
      const t = countMs === 0 ? 1 : Math.min((now - start) / countMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setCount(Math.round(target * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setCount(target);
        holdTimer = setTimeout(() => setAnimationDone(true), holdMs);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
    };
  }, [phase, countMs, holdMs, target]);

  // PERSIST MODE ONLY. Once the reveal has settled AND the write has landed:
  // play the short outro (the ring "breathes", a teal halo ripples out, the
  // chrome clears), then hand off to the dashboard. This is the first half of
  // the ring-to-dashboard transition that continues on `/danas`.
  //
  // A hard navigation (not the client router) is deliberate: the App Router
  // cache could otherwise serve a `/danas` response captured BEFORE
  // `onboarded_at` was set -- i.e. the middleware's bounce back to
  // `/onboarding`. A full request re-runs the middleware against the now
  // fully-onboarded profile, so the user actually lands on the dashboard.
  // We clear the stashed pre-auth answers now that they live on the account.
  // (The short-lived `fm_intro` cookie that used to continue the ring on
  // `/danas` is gone -- the next screen is the avatar, see below.)
  useEffect(() => {
    if (!persist || !animationDone || saveState !== "done") return;
    const enter = setTimeout(() => setLeaving(true), 0);
    const leave = setTimeout(() => {
      clearPendingOnboarding();
      // The ring hand-off to `/danas` is deliberately NOT armed any more: the
      // next screen is `/onboarding/klon`, and `fm_intro` lives 60 seconds --
      // by the time someone has picked twenty photos it would be long gone, and
      // if they skipped in five it would replay a ring they left two screens
      // ago. The dashboard just appears instead, exactly as it already does
      // under reduced motion.
      try {
        // Unlike the intro, the install offer is wanted under reduced motion
        // too (the overlay renders a static poster there). Consumed one-shot
        // by `InstallOverlay` on /danas. Ten minutes is long enough to survive
        // the klon detour below.
        document.cookie = `${INSTALL_COOKIE}=1; path=/; max-age=600; samesite=lax`;
      } catch {
        // No cookie -> no install offer; never a blocked navigation.
      }
      // Avatar first, dashboard second -- see `finish-and-redirect.tsx`, which
      // does the same for the (far more common) hand-off path. The klon screen
      // is skippable and its "Preskoči za sad" lands on /danas.
      window.location.assign("/onboarding/klon");
    }, outroMs);
    return () => {
      clearTimeout(enter);
      clearTimeout(leave);
    };
  }, [persist, animationDone, saveState, outroMs]);

  function retry() {
    setSaveError(undefined);
    setSaveState("saving");
    setSaveNonce((n) => n + 1);
  }

  if (persist && saveState === "error") {
    return (
      <main className="pr">
        <div className="pr-error" role="alert">
          <p>{saveError ?? t("onboarding.error.genericShort")}</p>
          <button type="button" className="pr-retry liquid-glass" onClick={retry}>
            {t("onboarding.retry")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`pr${leaving ? " pr-leaving" : ""}`}
      aria-live="polite"
    >
      {phase === "calc" ? (
        <div className="pr-stage">
          <div className="pr-orb">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle
                className="pr-track"
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="6"
              />
              <circle
                className="pr-arc"
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="70 194"
              />
            </svg>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pr-orb-core"
              src="/brand/fitmess-black.png"
              alt="FitMess"
              width={62}
              height={62}
            />
          </div>
          <div>
            {data.name ? (
              <div className="pr-calc-greeting">
                {t("onboarding.plan.greeting", { name: data.name })}
              </div>
            ) : null}
            <div className="pr-calc-title">{t("onboarding.plan.calcTitle")}</div>
            <div className="pr-calc-sub" key={calcLine}>
              {CALC_LINES[calcLine]}
            </div>
          </div>
          <div
            className="pr-progress"
            style={{ "--pr-calc-ms": `${calcMs}ms` } as CSSProperties}
          >
            <i />
          </div>
        </div>
      ) : (
        <div
          className="pr-stage pr-reveal"
          style={{ "--pr-count-ms": `${countMs}ms` } as CSSProperties}
        >
          <div className="pr-reveal-label">{t("onboarding.plan.dailyGoal")}</div>
          <div className="pr-ring">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle
                className="pr-ring-track"
                cx="100"
                cy="100"
                r="88"
                fill="none"
                strokeWidth="12"
              />
              <circle
                className="pr-ring-fill"
                cx="100"
                cy="100"
                r="88"
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </svg>
            <div className="pr-ring-center">
              <div className="pr-kcal" data-testid="daily-kcal">
                {formatKcal(count)}
              </div>
              <div className="pr-unit">{t("onboarding.plan.kcalPerDay")}</div>
            </div>
          </div>
          <div className="pr-macros">
            <div className="pr-macro">
              <b>{summary.macros.proteinG}g</b>
              <span>{t("macro.protein")}</span>
            </div>
            <div className="pr-macro">
              <b>{summary.macros.fatG}g</b>
              <span>{t("macro.fat")}</span>
            </div>
            <div className="pr-macro">
              <b>{summary.macros.carbsG}g</b>
              <span>{t("macro.carbs")}</span>
            </div>
          </div>

          {/* Guideline 1.4.1: this is the screen where the app first tells a
              person how much to eat, so it is the screen that owes them the
              equations behind it. Shown only once the reveal has settled --
              during the animation it would be reading material nobody has.
              Preview mode has no session yet, so it points at the PUBLIC
              document; `/profil/*` would bounce a visitor to the login form. */}
          {animationDone ? (
            <div className="pr-sources">
              <SourcesLink t={t} variant={persist ? "app" : "public"} />
            </div>
          ) : null}

          {/* Preview (pre-auth) mode: once the reveal has settled, invite the
              visitor to create an account so the plan is saved. Persist mode
              navigates on its own, so it never shows this. */}
          {!persist && animationDone ? (
            <div className="pr-cta">
              <p className="pr-cta-copy">{t("onboarding.plan.ctaCopy")}</p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={onContinue}
              >
                {t("onboarding.plan.ctaButton")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
