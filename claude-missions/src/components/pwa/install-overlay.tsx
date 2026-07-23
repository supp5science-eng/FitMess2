"use client";

import { useEffect, useRef, useState } from "react";

import "./install-overlay.css";

/**
 * The one-time, post-onboarding "install FitMess" moment.
 *
 * Shown as a full-screen overlay on `/danas`, exactly once, right after the
 * user has finished the whole journey (upitnik → registration → plan reveal →
 * ring hand-off intro) — the point of maximum investment, when "sad kad sam
 * sve završio, daj da instaliram" lands best. The trigger is the short-lived
 * `fm_install` cookie dropped by the plan reveal; this component CONSUMES it
 * on mount and additionally guards with localStorage, so the overlay can
 * never nag twice.
 *
 * It adapts to what the device can actually do:
 *  - Android / Chrome with a captured `beforeinstallprompt`: the primary CTA
 *    fires the REAL native install prompt; on success we flip to a short
 *    "Instalirano!" state and close.
 *  - iOS Safari (never fires that event): a smooth looping walkthrough — a
 *    mini phone that demonstrates Podeli → Dodaj na početni ekran → the
 *    FitMess tile landing on the home screen — with the three Serbian steps
 *    advancing in sync.
 *  - Anything else: the Chrome-menu walkthrough, so it's never a dead end.
 *
 * Dismissal is deliberately zero-shame: a quiet "Nastavi u pregledaču" link.
 * Never rendered when already running standalone. Everything collapses to a
 * static poster under `prefers-reduced-motion` (steps advance by tapping).
 *
 * Visual language matches the app (dark theme tokens, teal accent) and the
 * landing hero demo — not the landing's white `InstallGuide` modal, which
 * stays untouched for marketing use.
 */

const INSTALL_COOKIE = "fm_install";
const SEEN_KEY = "fm_install_seen";
const STEP_MS = 2600;
const OUT_MS = 360;

type Platform = "ios" | "android";
type Stage = "guide" | "installed";

// Minimal shape of the (still non-standard) beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The REAL modern iOS Safari flow (bottom address bar, iOS 15+): the share
// icon is NOT in the toolbar — you go ••• (More) → Podeli (Share) → the system
// share sheet → Dodaj na početni ekran. Verified against the product owner's
// own on-device screenshots (2026-07). Android/Chrome is the ⋮ menu flow.
const STEPS: Record<Platform, { key: string; text: React.ReactNode }[]> = {
  ios: [
    { key: "more", text: <>Tapni <b>•••</b> u dnu Safari-ja</> },
    { key: "share", text: <>Izaberi <b>Podeli</b></> },
    { key: "add", text: <>Tapni <b>Dodaj na početni ekran</b></> },
    { key: "done", text: <>I <b>FitMess</b> je na tvom ekranu 🎉</> },
  ],
  android: [
    { key: "menu", text: <>Tapni meni <b>⋮</b> gore desno</> },
    { key: "install", text: <>Izaberi <b>Instaliraj aplikaciju</b></> },
    { key: "done", text: <>I <b>FitMess</b> je na tvom ekranu 🎉</> },
  ],
};

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  const isIpadOs =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || isIpadOs) return "ios";
  // Android and anything else (desktop dev, rare browsers) share the Chrome
  // menu flow — the closest universal fallback.
  return "android";
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function InstallOverlay() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [stage, setStage] = useState<Stage>("guide");
  const [step, setStep] = useState(0);
  // Once the user taps a step to read it at their own pace, stop the auto-loop
  // so it never yanks them off the step they're looking at.
  const [paused, setPaused] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const reducedRef = useRef(false);

  // One-shot gating + capability detection. Consumes the fm_install cookie
  // unconditionally (even when we end up not showing) so a refresh never
  // resurrects the prompt.
  useEffect(() => {
    try {
      document.cookie = `${INSTALL_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } catch {
      // Blocked cookies only mean we rely on the localStorage guard below.
    }

    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen || isStandalone()) return;
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Best effort — the consumed cookie already prevents the common replay.
    }

    reducedRef.current = prefersReducedMotion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());

    // A short beat after the ring hand-off has settled, rise in.
    const show = window.setTimeout(() => setVisible(true), 700);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setStage("installed");
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(show);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Auto-advance the walkthrough while the guide is up (looping). Under
  // reduced motion — or once the user has tapped a step (`paused`) — we hold
  // and let the user drive the steps themselves.
  useEffect(() => {
    if (
      !visible ||
      leaving ||
      stage !== "guide" ||
      reducedRef.current ||
      paused
    )
      return;
    const count = STEPS[platform].length;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % count);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [visible, leaving, stage, platform, paused]);

  function close() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), OUT_MS);
  }

  async function onPrimary() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setStage("installed");
        window.setTimeout(close, 2200);
      }
    } finally {
      setDeferred(null);
    }
  }

  if (!visible) return null;

  const steps = STEPS[platform];

  return (
    <div
      className={`pwi${leaving ? " pwi-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Dodaj FitMess na početni ekran"
    >
      <div className="pwi-glow" aria-hidden="true" />

      {stage === "installed" ? (
        <div className="pwi-body pwi-done">
          <span className="pwi-done-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="pwi-appicon" />
            <span className="pwi-done-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
          </span>
          <h2 className="pwi-title">Instalirano! 🎉</h2>
          <p className="pwi-sub">
            Potraži <b>FitMess</b> na početnom ekranu — tu te čeka tvoj plan.
          </p>
        </div>
      ) : (
        <div className="pwi-body">
          <span className="pwi-hero">
            <span className="pwi-ripple" aria-hidden="true" />
            <span className="pwi-ripple pwi-ripple-2" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="pwi-appicon" />
          </span>

          <h2 className="pwi-title pwi-in pwi-d1">
            Tvoj plan te čeka <span className="pwi-hi">na jedan tap</span>
          </h2>
          <p className="pwi-sub pwi-in pwi-d2">
            Dodaj FitMess na početni ekran — otvara se kao prava aplikacija,
            bez kucanja adrese.
          </p>

          <div className="pwi-demo pwi-in pwi-d3">
            <MiniPhone platform={platform} step={step} />

            <ol className="pwi-steps">
              {steps.map((s, i) => (
                <li key={s.key} className={i === step ? "is-active" : ""}>
                  <button
                    type="button"
                    className="pwi-step-btn"
                    onClick={() => {
                      setPaused(true);
                      setStep(i);
                    }}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span className="pwi-num">{i + 1}</span>
                    <span className="pwi-step-text">{s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {platform === "ios" ? (
            <p className="pwi-note pwi-in pwi-d4">
              Ne vidiš „Dodaj na početni ekran”? Skroluj listu ili tapni
              {" "}
              <b>Prikaži još</b>.
            </p>
          ) : null}

          <div className="pwi-cta pwi-in pwi-d5">
            {deferred ? (
              <button type="button" className="pwi-install" onClick={onPrimary}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v13" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Instaliraj aplikaciju
              </button>
            ) : null}
            <button type="button" className="pwi-skip" onClick={close}>
              Nastavi u pregledaču
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The mini phone that DEMONSTRATES the current step — a dark-theme,
 * platform-accurate re-enactment. iOS mirrors the REAL modern Safari flow
 * (bottom bar with •••, not a toolbar share icon): ••• → the ••• menu with
 * Podeli → the system share sheet with "Dodaj na početni ekran" → the tile
 * landing on the home screen. Android: the ⋮ menu → Instaliraj aplikaciju →
 * home screen. The final home-screen layer is shared and sits at the last
 * step index of whichever platform (iOS: 3, Android: 2).
 */
function MiniPhone({ platform, step }: { platform: Platform; step: number }) {
  const lastIndex = STEPS[platform].length - 1;
  return (
    <div className="pwi-phone" data-step={step} data-platform={platform}>
      <span className="pwi-notch" aria-hidden="true" />
      <div className="pwi-screen">
        {platform === "ios" ? (
          <>
            {/* 0: Safari with the BOTTOM address bar; ••• (More) pulsing */}
            <div className="pwi-layer" data-for="0">
              <WebLines />
              <div className="pwi-bar pwi-bar-bottom">
                <span className="pwi-bar-ic">‹</span>
                <span className="pwi-omni pwi-omni-c">fitmess.app</span>
                <span className="pwi-bar-ic pwi-reload">↻</span>
                <span className="pwi-bar-ic pwi-target pwi-more">
                  •••<span className="pwi-tap" />
                </span>
              </div>
            </div>
            {/* 1: the ••• menu (bottom-right); Podeli highlighted */}
            <div className="pwi-layer" data-for="1">
              <WebLines dim />
              <div className="pwi-menu pwi-menu-br">
                <div className="pwi-row pwi-target">
                  <span>Podeli</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v13" />
                    <path d="m8 7 4-4 4 4" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                  <span className="pwi-tap" />
                </div>
                <div className="pwi-row">Dodaj obeleživač</div>
                <div className="pwi-row">Nova kartica</div>
              </div>
            </div>
            {/* 2: the system share sheet; Dodaj na početni ekran highlighted */}
            <div className="pwi-layer" data-for="2">
              <WebLines dim />
              <div className="pwi-sheet">
                <span className="pwi-grip" />
                <div className="pwi-share-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/landing/obrok.jpg" alt="" />
                  <span className="pwi-share-meta">
                    <b>FitMess</b>
                    <span>fitmess.app</span>
                  </span>
                </div>
                <div className="pwi-row">Kopiraj</div>
                <div className="pwi-row pwi-target">
                  <span>Dodaj na početni ekran</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M12 9v6M9 12h6" />
                  </svg>
                  <span className="pwi-tap" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 0: Chrome, kebab pulsing */}
            <div className="pwi-layer" data-for="0">
              <div className="pwi-bar pwi-bar-top">
                <span className="pwi-omni">fitmess.app</span>
                <span className="pwi-bar-ic pwi-target pwi-kebab">
                  ⋮<span className="pwi-tap" />
                </span>
              </div>
              <WebLines />
            </div>
            {/* 1: menu, target row */}
            <div className="pwi-layer" data-for="1">
              <div className="pwi-bar pwi-bar-top">
                <span className="pwi-omni">fitmess.app</span>
                <span className="pwi-bar-ic pwi-kebab">⋮</span>
              </div>
              <WebLines dim />
              <div className="pwi-menu">
                <div className="pwi-row">Nova kartica</div>
                <div className="pwi-row pwi-target">
                  <span>Instaliraj aplikaciju</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 3v12" />
                    <path d="m8 11 4 4 4-4" />
                    <path d="M5 21h14" />
                  </svg>
                  <span className="pwi-tap" />
                </div>
                <div className="pwi-row">Istorija</div>
              </div>
            </div>
          </>
        )}

        {/* shared final: home screen, tile pops in with a teal spark */}
        <div className="pwi-layer" data-for={String(lastIndex)}>
          <div className="pwi-home">
            <span className="pwi-dots" aria-hidden="true" />
            <span className="pwi-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" />
              <span className="pwi-tile-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <span className="pwi-spark" aria-hidden="true" />
            </span>
            <span className="pwi-tile-label">FitMess</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Faux page content lines behind the browser chrome. */
function WebLines({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`pwi-web${dim ? " is-dim" : ""}`} aria-hidden="true">
      <span className="pwi-line w1" />
      <span className="pwi-line w2" />
      <span className="pwi-line w3" />
      <span className="pwi-line w4" />
    </div>
  );
}
