"use client";

import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { computeBudgetSummary } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import "@/components/onboarding/name-screen.css";
import "@/components/onboarding/plan-reveal.css";
import "./ugc-scene.css";

/**
 * The UGC film, as one continuous scene: the last onboarding field being
 * typed, the CTA being pressed, the plan being calculated, and the daily kcal
 * counting up and settling.
 *
 * Every surface below is the shipped markup from
 * `components/onboarding/name-screen.tsx` and `plan-reveal.tsx`, class for
 * class, so it renders through the real stylesheets, tokens and Inter -- and
 * the number it lands on comes from the real budget engine
 * (`computeBudgetSummary`), not a literal.
 *
 * What IS re-implemented here is the timing. The shipped components animate on
 * the wall clock (CSS keyframes, `setTimeout`, `requestAnimationFrame`), which
 * a frame-stepped capture cannot seek. So `ugc-scene.css` switches those
 * animations off and this file recomputes each animated property from a
 * virtual clock `t`, reproducing the same keyframes, durations and easing
 * curves the stylesheets declare. `window.__ugc.seek(ms)` moves that clock;
 * the capture script steps it 1/24s at a time.
 */

// --------------------------------------------------------------------------
// The profile the film types in: 24yo male, 85kg, losing weight at the
// recommended 0.5 kg/week pace toward 78kg (14 weeks). Run through the real
// engine this is 1879 BMR -> 2584 TDEE -> 2034 kcal/day.
// --------------------------------------------------------------------------
const PROFILE: CompleteOnboardingData = {
  name: "Miloš",
  sex: "male",
  ageYears: 24,
  heightCm: 183,
  weightKg: 85,
  activityLevel: "light",
  goal: "lose",
  targetWeightKg: 78,
  pace: "recommended",
  timeframeWeeks: 14,
};

const NAME = PROFILE.name as string;

// --------------------------------------------------------------------------
// Timeline (ms on the virtual clock)
// --------------------------------------------------------------------------
export const FPS = 24;
export const DURATION_MS = 6500;

/** Per-keystroke times. Uneven on purpose -- a real thumb is not a metronome,
 * and the "š" (a long-press accent on an iOS keyboard) takes a beat longer. */
const KEY_TIMES = [430, 556, 668, 812, 962];
/** `.ns-cta` transition: 450ms cubic-bezier(0.22, 1, 0.36, 1). */
const CTA_MS = 450;
/** Chrome keeps the caret solid while typing, then resumes its 1s blink. */
const CARET_BLINK_MS = 1000;
const CARET_SETTLE_MS = 520;

const PRESS_AT = 1520;
const PRESS_MS = 150;
const RELEASE_AT = PRESS_AT + PRESS_MS;
const RIPPLE_MS = 520;
/** Ripple diameter in px -- wider than the pill so it clears its corners. */
const RIPPLE_SIZE = 320;

/** `ns-out` in name-screen.css. */
const NS_OUT_MS = 600;
/** The name screen hands off to the reveal exactly when its outro ends --
 * `NameScreen` calls `onSubmit` after `OUTRO_MS`. */
const PLAN_AT = RELEASE_AT + NS_OUT_MS;

/** Calculating phase. The shipped default is 2500ms; the film runs the short
 * version so the reveal is not the second half of the clip. */
const CALC_MS = 600;
const COUNT_AT = PLAN_AT + CALC_MS;
/** kcal count-up + ring draw. Shipped default is 1300ms. */
const COUNT_MS = 800;

// --------------------------------------------------------------------------
// Easing
// --------------------------------------------------------------------------

/** Solves a CSS `cubic-bezier(x1, y1, x2, y2)` for y at a given x. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleDx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return sampleY(t);
      const d = sampleDx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Newton stalled -- fall back to bisection.
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const mid = sampleX(t);
      if (Math.abs(mid - x) < 1e-6) break;
      if (x > mid) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
      if (hi - lo < 1e-7) break;
    }
    return sampleY(t);
  };
}

/** The three curves the onboarding stylesheets use. */
const easeOutExpo = cubicBezier(0.22, 1, 0.36, 1);
const easeOutQuint = cubicBezier(0.16, 1, 0.3, 1);
const easeStandard = cubicBezier(0.4, 0, 0.2, 1);

/** `clamp((now - start) / duration, 0, 1)` -- an animation's own progress. */
function progress(now: number, start: number, duration: number): number {
  if (duration <= 0) return now >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (now - start) / duration));
}

function mix(from: number, to: number, k: number): number {
  return from + (to - from) * k;
}

/** A `ease-in-out` sine loop, for the two ambient glows' breathing. */
function breathe(now: number, periodMs: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * now) / periodMs);
}

/** Same as `plan-reveal.tsx`. */
function formatKcal(n: number) {
  return n.toLocaleString("sr-RS");
}

// --------------------------------------------------------------------------
// iOS status bar. Drawn by the capture stage because on a device it belongs
// to the OS, above the web view -- the app never renders it.
// --------------------------------------------------------------------------
function StatusBar() {
  return (
    <div className="ugc-statusbar">
      <span className="ugc-statusbar-time">9:41</span>
      <span className="ugc-statusbar-icons">
        {/* Cellular */}
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="5" y="6" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="10" y="3.5" width="3" height="8.5" rx="1" fill="currentColor" />
          <rect x="15" y="1" width="3" height="11" rx="1" fill="currentColor" />
        </svg>
        {/* Wi-Fi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
          <path
            d="M1 4.2a10.5 10.5 0 0 1 14 0"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M3.6 6.9a6.8 6.8 0 0 1 8.8 0"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M6.1 9.6a3 3 0 0 1 3.8 0"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
        {/* Battery, 80% */}
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden>
          <rect
            x="0.6"
            y="0.6"
            width="21.8"
            height="11.8"
            rx="3.7"
            stroke="currentColor"
            strokeOpacity="0.38"
            strokeWidth="1.1"
          />
          <rect x="2.1" y="2.1" width="15.2" height="8.8" rx="2.4" fill="currentColor" />
          <path
            d="M24.1 4.5c1.15.45 1.15 3.55 0 4V4.5Z"
            fill="currentColor"
            fillOpacity="0.45"
          />
        </svg>
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Scene
// --------------------------------------------------------------------------
export function UgcScene() {
  const { t } = useT();
  const [now, setNow] = useState(0);
  const summary = computeBudgetSummary(PROFILE);
  const target = summary.dailyKcal;

  // The capture script's only handle on the scene: set the virtual clock,
  // wait a frame, screenshot, repeat.
  useEffect(() => {
    const api = {
      fps: FPS,
      durationMs: DURATION_MS,
      frames: Math.round((DURATION_MS / 1000) * FPS),
      seek: (ms: number) => setNow(ms),
      ready: true,
    };
    (window as unknown as { __ugc: typeof api }).__ugc = api;
  }, []);

  const showPlan = now >= PLAN_AT;

  // ---- name screen ------------------------------------------------------
  const typedCount = KEY_TIMES.filter((keyAt) => now >= keyAt).length;
  const typed = NAME.slice(0, typedCount);
  const hasName = typed.trim() !== "";
  const lastKeyAt = typedCount > 0 ? KEY_TIMES[typedCount - 1] : -Infinity;

  // Solid while typing (and for a moment after the last keystroke), then the
  // browser's 1s blink resumes.
  const sinceKey = now - lastKeyAt;
  const caretOn =
    typedCount === 0
      ? now % CARET_BLINK_MS < CARET_BLINK_MS / 2
      : sinceKey < CARET_SETTLE_MS
        ? true
        : (sinceKey - CARET_SETTLE_MS) % CARET_BLINK_MS < CARET_BLINK_MS / 2;

  // `.ns-cta` reveals as soon as there is a name, on a 450ms curve.
  const ctaK = easeOutExpo(progress(now, KEY_TIMES[0], CTA_MS));

  const pressed = now >= PRESS_AT && now < RELEASE_AT;
  const rippleK = progress(now, PRESS_AT, RIPPLE_MS);

  // `ns-out`: the stage exhales as the plan is handed off.
  const leaving = now >= RELEASE_AT;
  const outK = easeStandard(progress(now, RELEASE_AT, NS_OUT_MS));

  // `.ns::before`: settled after `ns-glow-in`, breathing on a 4s loop, then
  // flaring once (`ns-glow-flare`) during the outro.
  const nsBreath = breathe(now + 900, 4000);
  let nsGlowO = mix(0.5, 0.8, nsBreath);
  let nsGlowS = mix(0.95, 1.05, nsBreath);
  if (leaving) {
    const f = progress(now, RELEASE_AT, NS_OUT_MS);
    if (f <= 0.45) {
      const k = f / 0.45;
      nsGlowO = mix(0.65, 0.95, k);
      nsGlowS = mix(1, 1.18, k);
    } else {
      const k = (f - 0.45) / 0.55;
      nsGlowO = mix(0.95, 0.35, k);
      nsGlowS = mix(1.18, 1.05, k);
    }
  }

  // ---- plan reveal ------------------------------------------------------
  const planNow = now - PLAN_AT;
  const revealing = now >= COUNT_AT;

  // `.pr::before` breathes on a 3.4s loop.
  const prBreath = breathe(planNow, 3400);
  const prGlowO = mix(0.5, 0.85, prBreath);
  const prGlowS = mix(0.94, 1.06, prBreath);

  // Calculating phase: `pr-spin` (1.1s/turn), `pr-pulse` (1.6s), `pr-fill`.
  const orbSpin = ((planNow / 1100) % 1) * 360;
  const orbPulse = breathe(planNow, 1600);
  const fillK = easeStandard(progress(now, PLAN_AT, CALC_MS));
  const greetK = progress(now, PLAN_AT, 500);
  const subK = progress(now, PLAN_AT, 400);

  // Reveal: `pr-rise`, the ring draw and the kcal count share `COUNT_MS`.
  const riseK = easeOutQuint(progress(now, COUNT_AT, 500));
  const drawK = easeOutExpo(progress(now, COUNT_AT, COUNT_MS));
  const countLinear = progress(now, COUNT_AT, COUNT_MS);
  // easeOutCubic -- the exact curve `plan-reveal.tsx` counts on.
  const count = Math.round(target * (1 - Math.pow(1 - countLinear, 3)));

  const chip = (delayMs: number): CSSProperties => {
    const k = easeOutQuint(progress(now, COUNT_AT + delayMs, 500));
    return { opacity: k, transform: `translateY(${mix(8, 0, k)}px)` };
  };

  const settled: CSSProperties = { opacity: 1, filter: "none", transform: "none" };

  return (
    <div
      className="ugc-stage bg-background text-foreground"
      style={{ "--ugc-caret": caretOn ? 1 : 0 } as CSSProperties}
    >
      <StatusBar />

      {!showPlan ? (
        <main
          className={`ns${leaving ? " ns-leaving" : ""}`}
          style={
            { "--ugc-glow-o": nsGlowO, "--ugc-glow-s": nsGlowS } as CSSProperties
          }
        >
          <div
            className="ns-stage"
            style={
              leaving
                ? {
                    opacity: 1 - outK,
                    filter: `blur(${mix(0, 6, outK)}px)`,
                    transform: `translateY(${mix(0, -14, outK)}px) scale(${mix(1, 0.985, outK)})`,
                  }
                : undefined
            }
          >
            <span className="ns-kicker" style={settled}>
              {t("onboarding.name.kicker")}
            </span>
            <h1 className="ns-title">
              {t("onboarding.name.title")
                .split(" ")
                .map((word, i) => (
                  <React.Fragment key={word}>
                    {i > 0 ? " " : null}
                    <span className="ns-word" style={settled}>
                      {word}
                    </span>
                  </React.Fragment>
                ))}
            </h1>

            <div className="ns-field" style={settled}>
              <div className="ns-input ugc-input">
                <span className="ugc-input-inner">
                  {typed === "" ? (
                    <span className="ugc-placeholder">
                      {t("onboarding.name.placeholder")}
                    </span>
                  ) : (
                    <span>{typed}</span>
                  )}
                  <i className="ugc-caret" />
                </span>
              </div>
              <p className="ns-hint" style={settled}>
                {t("onboarding.name.hint")}
              </p>
            </div>

            <div
              className={`ns-cta${hasName ? " ns-cta-show" : ""}`}
              style={{
                position: "relative",
                opacity: ctaK,
                visibility: hasName ? "visible" : "hidden",
                transform: `translateY(${mix(14, 0, ctaK)}px)`,
              }}
            >
              <div className={pressed ? "ugc-press" : undefined}>
                <Button
                  type="button"
                  className="h-14 w-full rounded-full text-base font-semibold"
                >
                  {t("onboarding.continue")}
                </Button>
              </div>
              {rippleK > 0 && rippleK < 1 ? (
                <span className="ugc-tap" aria-hidden>
                  <i
                    style={{
                      left: "50%",
                      top: "50%",
                      width: RIPPLE_SIZE,
                      height: RIPPLE_SIZE,
                      marginLeft: -RIPPLE_SIZE / 2,
                      marginTop: -RIPPLE_SIZE / 2,
                      opacity: Math.pow(1 - rippleK, 1.6),
                      transform: `scale(${mix(0.04, 1, easeOutExpo(rippleK))})`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          </div>
        </main>
      ) : (
        <main
          className="pr"
          style={
            { "--ugc-glow-o": prGlowO, "--ugc-glow-s": prGlowS } as CSSProperties
          }
        >
          {!revealing ? (
            <div className="pr-stage">
              <div className="pr-orb">
                <svg viewBox="0 0 100 100" style={{ transform: `rotate(${orbSpin}deg)` }} aria-hidden>
                  <circle className="pr-track" cx="50" cy="50" r="42" fill="none" strokeWidth="6" />
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
                  style={{
                    transform: `scale(${mix(0.94, 1.06, orbPulse)})`,
                    opacity: mix(0.85, 1, orbPulse),
                  }}
                />
              </div>
              <div>
                <div
                  className="pr-calc-greeting"
                  style={{
                    opacity: greetK,
                    transform: `translateY(${mix(4, 0, greetK)}px)`,
                  }}
                >
                  {t("onboarding.plan.greeting", { name: NAME })}
                </div>
                <div className="pr-calc-title">{t("onboarding.plan.calcTitle")}</div>
                <div
                  className="pr-calc-sub"
                  style={{
                    opacity: subK,
                    transform: `translateY(${mix(4, 0, subK)}px)`,
                  }}
                >
                  {t("onboarding.plan.calc1")}
                </div>
              </div>
              <div className="pr-progress">
                <i style={{ width: `${fillK * 100}%` }} />
              </div>
            </div>
          ) : (
            <div
              className="pr-stage pr-reveal"
              style={{
                opacity: riseK,
                transform: `translateY(${mix(10, 0, riseK)}px) scale(${mix(0.98, 1, riseK)})`,
              }}
            >
              <div className="pr-reveal-label">{t("onboarding.plan.dailyGoal")}</div>
              <div className="pr-ring">
                <svg viewBox="0 0 200 200" aria-hidden>
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
                    style={{ strokeDashoffset: mix(553, 55, drawK) }}
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
                <div className="pr-macro" style={chip(150)}>
                  <b>{summary.macros.proteinG}g</b>
                  <span>{t("macro.protein")}</span>
                </div>
                <div className="pr-macro" style={chip(280)}>
                  <b>{summary.macros.fatG}g</b>
                  <span>{t("macro.fat")}</span>
                </div>
                <div className="pr-macro" style={chip(410)}>
                  <b>{summary.macros.carbsG}g</b>
                  <span>{t("macro.carbs")}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
