"use client";

import { useEffect, useState } from "react";

import { InstallGuide } from "@/components/landing/install-guide";

/**
 * The landing page's "Instaliraj FitMess" call to action — the single most
 * important control on the marketing page, since driving PWA installs is the
 * page's whole job.
 *
 * It adapts to what the current browser can actually do:
 *  - Android / desktop Chrome & Edge: captures the `beforeinstallprompt`
 *    event and triggers the real native install prompt on click.
 *  - iOS Safari (which never fires that event): opens a short Serbian
 *    "Podeli → Dodaj na početni ekran" instruction sheet.
 *  - Already installed (running standalone): becomes an "Otvori FitMess"
 *    button that jumps straight into the app.
 *  - Anything else (e.g. Firefox, or Chrome that hasn't offered the prompt
 *    yet): falls back to the same manual instruction sheet, so the button is
 *    never a dead end.
 *
 * Rendered as an island inside the `.lp` landing markup so it inherits the
 * page's own `.btn` styling; callers pass `className` to pick the variant.
 */

// Minimal shape of the (still non-standard) beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const APP_HOME = "/danas";

type Mode = "install" | "ios" | "open" | "manual";
/** Which animated walkthrough the guide should show. `other` (desktop /
 * unknown) falls back to the Android/Chrome-style "open the menu" flow. */
type GuidePlatform = "ios" | "android";

function detectPlatform(): "ios" | "android" | "other" {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isIpadOs =
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1;
  if (isIos || isIpadOs) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/** Resolve what the current browser can do, post-hydration (window-only). */
function detectInitialMode(): Mode {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this legacy flag when launched from the home screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) return "open";

  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as desktop Safari; catch it via touch + Mac platform.
  const isIpadOs =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  if (isIos || isIpadOs) return "ios";
  // No captured prompt yet → manual until (and unless) one arrives.
  return "manual";
}

export function InstallButton({
  className = "",
  label = "Instaliraj FitMess",
  showArrow = true,
}: {
  className?: string;
  label?: string;
  showArrow?: boolean;
}) {
  // Start in a deterministic state so server and first client render match;
  // real capabilities are resolved in the effect below, after mount.
  const [mode, setMode] = useState<Mode>("install");
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const initialMode = detectInitialMode();
    // One-time capability detection that can only run after hydration: the
    // server (and first client) render must stay deterministic ("install"),
    // and the real capability is only knowable from window APIs on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(initialMode);
    setPlatform(detectPlatform());

    if (initialMode === "open") {
      // Already installed & running standalone — install events won't fire.
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("install");
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode("open");
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onClick() {
    if (mode === "open") {
      window.location.href = APP_HOME;
      return;
    }
    if (mode === "install" && deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setMode("open");
      }
      setDeferred(null);
      return;
    }
    // ios + manual → show the instruction sheet.
    setHelpOpen(true);
  }

  const text = mode === "open" ? "Otvori FitMess" : label;

  return (
    <>
      <button type="button" className={`btn ${className}`} onClick={onClick}>
        {showArrow && mode !== "open" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v13" />
            <path d="m7 12 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        ) : null}
        {mode === "open" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        ) : null}
        {text}
      </button>

      {helpOpen ? (
        <InstallGuide
          platform={guidePlatform(mode, platform)}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Which walkthrough to show: iOS gets Safari; everything else (Android and
 * desktop/unknown) gets the Chrome menu flow. */
function guidePlatform(
  mode: Mode,
  platform: "ios" | "android" | "other"
): GuidePlatform {
  if (mode === "ios" || platform === "ios") return "ios";
  return "android";
}
