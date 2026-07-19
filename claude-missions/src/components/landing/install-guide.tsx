"use client";

import { useEffect, useState } from "react";

import "./install-guide.css";

/**
 * Animated, platform-aware "how to install FitMess" guide shown from the
 * landing page's install CTA when the browser can't fire a native install
 * prompt (iOS always; Android/desktop when no `beforeinstallprompt` was
 * captured).
 *
 * Instead of a wall of text it shows a small looping phone mock-up that
 * actually *demonstrates* each step (the Share button pulsing, the sheet
 * sliding up, the icon landing on the home screen) with the three short
 * Serbian steps advancing in sync. iOS gets the Safari flow, Android the
 * Chrome flow. Everything collapses to a readable static state under
 * `prefers-reduced-motion`.
 *
 * Fully self-contained (own `.ig-*` CSS with explicit brand colors) so it
 * doesn't depend on the landing page's own scoped styles.
 */

type Platform = "ios" | "android";

const STEP_MS = 2600;

const STEPS: Record<Platform, { key: string; text: React.ReactNode }[]> = {
  ios: [
    { key: "share", text: <>Tapni <b>Podeli</b> u dnu Safari-ja</> },
    { key: "add", text: <>Izaberi <b>Dodaj na početni ekran</b></> },
    { key: "done", text: <>Potvrdi na <b>Dodaj</b> — i gotovo!</> },
  ],
  android: [
    { key: "menu", text: <>Tapni meni <b>⋮</b> gore desno</> },
    { key: "install", text: <>Izaberi <b>Instaliraj aplikaciju</b></> },
    { key: "done", text: <>Potvrdi na <b>Instaliraj</b> — i gotovo!</> },
  ],
};

export function InstallGuide({
  platform,
  onClose,
}: {
  platform: Platform;
  onClose: () => void;
}) {
  const steps = STEPS[platform];
  const [step, setStep] = useState(0);

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Auto-advance the walkthrough (looping). Under reduced motion we hold on
  // the first step and let the user tap the dots.
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduced, steps.length]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const browserLabel = platform === "ios" ? "iPhone · Safari" : "Android · Chrome";

  return (
    <div
      className="ig-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Kako da instaliraš FitMess"
      onClick={onClose}
    >
      <div className="ig-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ig-x"
          onClick={onClose}
          aria-label="Zatvori"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="ig-head">
          <h3 className="ig-title">Instaliraj FitMess</h3>
          <span className="ig-badge">{browserLabel}</span>
        </div>

        {platform === "ios" ? (
          <IosPhone step={step} />
        ) : (
          <AndroidPhone step={step} />
        )}

        <ol className="ig-steps">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className={i === step ? "is-active" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="ig-num">{i + 1}</span>
              <span className="ig-text">{s.text}</span>
            </li>
          ))}
        </ol>

        <div className="ig-dots" role="tablist" aria-label="Koraci">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`ig-dot${i === step ? " is-active" : ""}`}
              aria-label={`Korak ${i + 1}`}
              aria-selected={i === step}
              role="tab"
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {platform === "ios" ? (
          <p className="ig-foot">
            Mora <b>Safari</b> — na iPhone-u samo on ume da doda na ekran.
          </p>
        ) : (
          <p className="ig-foot">Najbolje radi u <b>Chrome</b>-u.</p>
        )}
      </div>
    </div>
  );
}

/** A shared phone shell; children are the animated screen contents. */
function Phone({
  step,
  platform,
  children,
}: {
  step: number;
  platform: Platform;
  children: React.ReactNode;
}) {
  return (
    <div className="ig-stage">
      <div className="ig-phone" data-step={step} data-platform={platform}>
        <span className="ig-notch" />
        <div className="ig-screen">{children}</div>
      </div>
    </div>
  );
}

/** Faux web content lines shared by both platforms. */
function WebLines({ className = "" }: { className?: string }) {
  return (
    <div className={`ig-web ${className}`}>
      <span className="ig-line w1" />
      <span className="ig-line w2" />
      <span className="ig-line w3" />
      <span className="ig-line w4" />
    </div>
  );
}

/** The FitMess home-screen tile that pops in on the final step -- the real
 * app icon (`/brand/fitmess-black.png`). */
function AppTile() {
  return (
    <div className="ig-tile" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/fitmess-black.png" alt="" width={62} height={62} />
      <span className="ig-tile-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>
    </div>
  );
}

function IosPhone({ step }: { step: number }) {
  return (
    <Phone step={step} platform="ios">
      {/* Step 1: Safari with the Share button pulsing */}
      <div className="ig-layer" data-for="0">
        <WebLines />
        <div className="ig-safaribar">
          <span className="ig-sb-ic">‹</span>
          <span className="ig-sb-ic">›</span>
          <span className="ig-sb-ic ig-target">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v13" />
              <path d="m8 7 4-4 4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            <span className="ig-tap" />
          </span>
          <span className="ig-sb-ic">▢</span>
        </div>
      </div>

      {/* Step 2: Share sheet up, "Add to Home Screen" row highlighted */}
      <div className="ig-layer" data-for="1">
        <WebLines className="is-dim" />
        <div className="ig-sheet">
          <span className="ig-sheet-grip" />
          <div className="ig-sheet-row">Kopiraj</div>
          <div className="ig-sheet-row ig-target">
            <span>Dodaj na početni ekran</span>
            <span className="ig-plus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="ig-tap" />
          </div>
          <div className="ig-sheet-row">Označi stranicu</div>
        </div>
      </div>

      {/* Step 3: Home screen, tile pops in */}
      <div className="ig-layer" data-for="2">
        <div className="ig-homescreen">
          <span className="ig-dotgrid" />
          <AppTile />
        </div>
      </div>
    </Phone>
  );
}

function AndroidPhone({ step }: { step: number }) {
  return (
    <Phone step={step} platform="android">
      {/* Step 1: Chrome top bar with the ⋮ menu pulsing */}
      <div className="ig-layer" data-for="0">
        <div className="ig-chromebar">
          <span className="ig-omnibox">fitmess.app</span>
          <span className="ig-sb-ic ig-target ig-kebab">
            ⋮<span className="ig-tap" />
          </span>
        </div>
        <WebLines />
      </div>

      {/* Step 2: menu open, "Instaliraj aplikaciju" highlighted */}
      <div className="ig-layer" data-for="1">
        <div className="ig-chromebar">
          <span className="ig-omnibox">fitmess.app</span>
          <span className="ig-sb-ic ig-kebab">⋮</span>
        </div>
        <WebLines className="is-dim" />
        <div className="ig-menu">
          <div className="ig-menu-row">Nova kartica</div>
          <div className="ig-menu-row ig-target">
            <span>Instaliraj aplikaciju</span>
            <span className="ig-plus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 21h14" />
              </svg>
            </span>
            <span className="ig-tap" />
          </div>
          <div className="ig-menu-row">Istorija</div>
        </div>
      </div>

      {/* Step 3: home screen, tile pops in */}
      <div className="ig-layer" data-for="2">
        <div className="ig-homescreen">
          <span className="ig-dotgrid" />
          <AppTile />
        </div>
      </div>
    </Phone>
  );
}
