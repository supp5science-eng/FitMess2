"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { finishOnboardingAction } from "@/app/(app)/onboarding/pregled/actions";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import "./plan-reveal.css";

/**
 * The onboarding finale (replaces the old editable summary): after the last
 * wizard question we don't drop the user on a form -- we play a short,
 * premium "računamo tvoj plan" animation, reveal the daily kcal target with
 * a counting ring, then continue straight to `/danas`.
 *
 * The write happens in the background here (`finishOnboardingAction`, which
 * deliberately does NOT redirect) so the animation is never cut short; we
 * navigate ourselves only once BOTH the animation has finished and the write
 * has landed. If the write fails, we surface a friendly Serbian retry instead
 * of navigating.
 */

const CALC_MS = 2500;
const COUNT_MS = 1300;
const HOLD_MS = 1400;
const OUTRO_MS = 900;

// Shared with `/danas` (loading.tsx + HomeScreen): a short-lived cookie that
// carries the just-computed daily target across the hard navigation so the
// dashboard can play the "ring hand-off" intro (matching loading cover, then
// a ghost ring that glides into the real daily ring) with zero seam.
const INTRO_COOKIE = "fm_intro";

const CALC_LINES = [
  "Analiziramo tvoje podatke…",
  "Računamo optimalan unos…",
  "Podešavamo makronutrijente…",
  "Skoro gotovo…",
];

function formatKcal(n: number) {
  return n.toLocaleString("sr-RS");
}

type Phase = "calc" | "reveal";
type SaveState = "saving" | "done" | "error";

export function PlanReveal({ data }: { data: CompleteOnboardingData }) {
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

  // Persist in the background (retried by bumping `saveNonce`).
  useEffect(() => {
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
        setSaveError("Nešto je pošlo naopako. Pokušaj ponovo.");
        setSaveState("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [data, saveNonce]);

  // Cycle the reassurance copy during the calc phase.
  useEffect(() => {
    if (phase !== "calc" || reduced) return;
    const id = setInterval(() => {
      setCalcLine((i) => Math.min(i + 1, CALC_LINES.length - 1));
    }, calcMs / CALC_LINES.length);
    return () => clearInterval(id);
  }, [phase, reduced, calcMs]);

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

  // Once the reveal has settled AND the write has landed: play the short
  // outro (the ring "breathes", a teal halo ripples out, the chrome clears),
  // then hand off to the dashboard. This is the first half of the
  // ring-to-dashboard transition that continues on `/danas`.
  //
  // A hard navigation (not the client router) is deliberate: the App Router
  // cache could otherwise serve a `/danas` response captured BEFORE
  // `onboarded_at` was set -- i.e. the middleware's bounce back to
  // `/onboarding`. A full request re-runs the middleware against the now
  // fully-onboarded profile, so the user actually lands on the dashboard.
  // Just before leaving we drop a short-lived cookie carrying the target so
  // `/danas` can continue the ring hand-off seamlessly (skipped under reduced
  // motion -- the dashboard then just appears).
  //
  // `setLeaving` runs inside a timer (not synchronously in the effect body)
  // so a single frame of the settled reveal is committed before the outro.
  useEffect(() => {
    if (!animationDone || saveState !== "done") return;
    const enter = setTimeout(() => setLeaving(true), 0);
    const leave = setTimeout(() => {
      if (!reduced) {
        try {
          document.cookie = `${INTRO_COOKIE}=${target}; path=/; max-age=60; samesite=lax`;
        } catch {
          // A blocked cookie only means no intro animation -- never a blocked
          // navigation, so we still hand off below.
        }
      }
      window.location.assign("/danas");
    }, outroMs);
    return () => {
      clearTimeout(enter);
      clearTimeout(leave);
    };
  }, [animationDone, saveState, outroMs, reduced, target]);

  function retry() {
    setSaveError(undefined);
    setSaveState("saving");
    setSaveNonce((n) => n + 1);
  }

  if (saveState === "error") {
    return (
      <main className="pr">
        <div className="pr-error" role="alert">
          <p>{saveError ?? "Nešto je pošlo naopako."}</p>
          <button type="button" className="pr-retry" onClick={retry}>
            Pokušaj ponovo
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
              <div className="pr-calc-greeting">Zdravo, {data.name}!</div>
            ) : null}
            <div className="pr-calc-title">Računamo tvoj plan</div>
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
          <div className="pr-reveal-label">Tvoj dnevni cilj</div>
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
              <div className="pr-unit">kcal dnevno</div>
            </div>
          </div>
          <div className="pr-macros">
            <div className="pr-macro">
              <b>{summary.macros.proteinG}g</b>
              <span>Proteini</span>
            </div>
            <div className="pr-macro">
              <b>{summary.macros.fatG}g</b>
              <span>Masti</span>
            </div>
            <div className="pr-macro">
              <b>{summary.macros.carbsG}g</b>
              <span>UH</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
