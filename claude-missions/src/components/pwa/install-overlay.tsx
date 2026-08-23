"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { isNativeApp } from "@/lib/device/native";
import { storeUrlFor } from "@/lib/device/stores";
import type { TFunction } from "@/lib/i18n/translate";

import "./install-overlay.css";

/**
 * The "install FitMess" moment. Two gates, one overlay (`mode`):
 *
 * - `onboarding` (default) — the one-time, post-onboarding moment on `/danas`,
 *   right after the user has finished the whole journey (upitnik →
 *   registration → plan reveal → ring hand-off intro): the point of maximum
 *   investment, when "sad kad sam sve završio, daj da instaliram" lands best.
 *   Triggered by the short-lived `fm_install` cookie dropped by the plan
 *   reveal; this component CONSUMES it on mount and guards with localStorage,
 *   so that moment can never replay.
 *
 * - `revisit` — the recurring nudge for people still using FitMess in a
 *   browser tab. Mounted app-wide (`InstallNudge` in the app shell) and shown
 *   again on each fresh visit, because a single install pitch converts a
 *   fraction of people and the rest keep paying the "find the tab" tax
 *   forever. Gated by `VISIT_GAP_MS` since the last showing, so it appears
 *   once per visit — never twice in one sitting, never on a reload.
 *
 * Both gates stand down permanently once the app is actually installed
 * (`display-mode: standalone`, or an `appinstalled` event we recorded), so
 * nobody is ever asked to install something they already have.
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
/** When the overlay was last shown (either gate). Both write it, both read it,
 * so the post-onboarding moment and the recurring nudge can never stack up on
 * the same visit. */
const SHOWN_AT_KEY = "fm_install_shown_at";
/** Set once an `appinstalled` event is seen. There is no API to ask "is this
 * site already installed?" from inside a browser tab, so remembering the one
 * moment the browser DOES tell us is the only way to stop nagging someone who
 * installed the app and later opened a stale tab. */
const INSTALLED_KEY = "fm_installed";
const STEP_MS = 2600;
const OUT_MS = 360;

/** How long after the last showing counts as a NEW visit. The brief is "every
 * time they leave and come back" — this is the one knob that says how literally
 * to take that. 30 min is short enough that a genuine return trip (morning →
 * lunch → evening) gets asked again, and long enough that a reload, a tab
 * switch, or a walk through the "+" flows never re-triggers it mid-sitting. */
const VISIT_GAP_MS = 30 * 60 * 1000;

/** The post-onboarding moment lands right after the ring hand-off settles; the
 * revisit nudge waits a little longer so the app paints and the user sees their
 * day FIRST -- a modal over a blank screen reads as breakage, not as an offer. */
const ONBOARDING_DELAY_MS = 700;
const REVISIT_DELAY_MS = 2600;

type Platform = "ios" | "android";
type Stage = "guide" | "installed";
/** Which gate decides whether this overlay shows. See the file comment. */
export type InstallOverlayMode = "onboarding" | "revisit";

// Minimal shape of the (still non-standard) beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The REAL modern iOS Safari flow (bottom address bar, iOS 15+): the share
// icon is NOT in the toolbar — you go ••• (More) → Podeli (Share) → the system
// share sheet → Dodaj na početni ekran. Verified against the product owner's
// own on-device screenshots (2026-07). Android/Chrome is the ⋮ menu flow.
/**
 * The "add it to your Home Screen" walkthrough — for platforms that have NO
 * store listing yet, which today means Android alone (`@/lib/device/stores`
 * explains why Play is still dark).
 *
 * iOS is deliberately absent. The App Store listing went live on 23.08.2026,
 * and from that moment teaching an iPhone visitor a bookmark trick is worse
 * than useless: it hands them a second-class copy of an app they could simply
 * download, with no automatic updates and no native push. Everything the iOS
 * half of this file used to render — the Safari share-sheet re-enactment, the
 * "Prikaži još" hint, the notifications-only-when-installed warning — went
 * with it. When Play goes live this whole walkthrough follows.
 */
const ANDROID_STEPS: { key: string }[] = [
  { key: "menu" },
  { key: "install" },
  { key: "done" },
];

/** Walkthrough steps for a platform, or none when a store link replaces it. */
function stepsFor(platform: Platform): { key: string }[] {
  return platform === "android" && storeUrlFor("android") === null
    ? ANDROID_STEPS
    : [];
}

/** The per-step instruction text, rebuilt from translation keys (the bolded
 * word is a `<b>` around a separate key, so word order can differ by language). */
function stepText(platform: Platform, key: string, t: TFunction): ReactNode {
  switch (`${platform}.${key}`) {
    case "android.menu":
      return <>{t("app.pwi.step.android.menu.a")} <b>⋮</b> {t("app.pwi.step.android.menu.c")}</>;
    case "android.install":
      return <>{t("app.pwi.step.android.install.a")} <b>{t("app.pwi.step.android.install.b")}</b></>;
    case "android.done":
      return <>{t("app.pwi.step.done.a")} <b>{t("app.pwi.step.done.b")}</b> {t("app.pwi.step.done.c")}</>;
    default:
      return null;
  }
}

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

/** localStorage can throw (Safari private mode, blocked storage). Every read
 * degrades to "no record", every write is best-effort: worst case the overlay
 * shows a little more often than intended, which beats crashing the shell. */
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best effort only.
  }
}

/** True once the app is installed on this device, by any signal we have.
 *
 * The native shell counts, and counts FIRST: someone who installed FitMess
 * from the App Store or Google Play has already done the thing this overlay
 * asks for, and inside a native web view none of the signals below fire --
 * `display-mode` is not standalone, no `appinstalled` event ever happened, and
 * on iOS the walkthrough would be teaching a Safari flow that does not exist in
 * that window. An install pitch shown inside the installed app is the clearest
 * possible sign that nobody tested it there. */
function alreadyInstalled(): boolean {
  return isNativeApp() || isStandalone() || readStore(INSTALLED_KEY) === "1";
}

function markShownNow(): void {
  writeStore(SHOWN_AT_KEY, String(Date.now()));
}

/** Has enough time passed since the last showing to call this a new visit? */
function isNewVisit(): boolean {
  const raw = readStore(SHOWN_AT_KEY);
  if (raw === null) return true;
  const last = Number(raw);
  // A corrupt value must not lock the nudge out forever.
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= VISIT_GAP_MS;
}

export function InstallOverlay({
  mode = "onboarding",
}: {
  mode?: InstallOverlayMode;
} = {}) {
  const { t } = useT();
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

  // Gating + capability detection. The onboarding gate consumes the fm_install
  // cookie unconditionally (even when we end up not showing) so a refresh never
  // resurrects that one-shot moment.
  useEffect(() => {
    if (mode === "onboarding") {
      try {
        document.cookie = `${INSTALL_COOKIE}=; path=/; max-age=0; samesite=lax`;
      } catch {
        // Blocked cookies only mean we rely on the localStorage guard below.
      }
    }

    // Never ask someone to install what they already installed -- checked
    // first, before either gate's own bookkeeping.
    if (alreadyInstalled()) return;

    if (mode === "onboarding") {
      // One-shot: this exact moment (right after finishing onboarding) fires
      // once per device, ever.
      if (readStore(SEEN_KEY) === "1") return;
    } else if (!isNewVisit()) {
      // Recurring, but only once per visit: a reload, a trip through the "+"
      // flows, or the onboarding overlay that just ran all land inside the gap.
      return;
    }

    reducedRef.current = prefersReducedMotion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());

    // The "we asked" bookkeeping is written when the overlay ACTUALLY rises,
    // never up here when we merely decide to. Writing it at decision time
    // burns the slot on any mount that gets torn down before the delay
    // elapses -- React's development double-mount, or the user tapping into a
    // logging flow within the first couple of seconds -- and the re-mounted
    // gate then reads its own record, concludes "already asked", and goes
    // quiet. The result is a prompt that silently never shows.
    const show = window.setTimeout(
      () => {
        if (mode === "onboarding") writeStore(SEEN_KEY, "1");
        markShownNow();
        setVisible(true);
      },
      mode === "onboarding" ? ONBOARDING_DELAY_MS : REVISIT_DELAY_MS
    );

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      // Remember it: this is the only moment a browser ever tells us the app
      // got installed, and it is what stops the nudge for good.
      writeStore(INSTALLED_KEY, "1");
      setStage("installed");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(show);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [mode]);

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
    const count = stepsFor(platform).length;
    // A platform sent straight to its store has no steps to cycle through.
    if (count === 0) return;
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
        // Belt and braces with the `appinstalled` listener: whichever signal
        // arrives first retires the nudge for good.
        writeStore(INSTALLED_KEY, "1");
        setStage("installed");
        window.setTimeout(close, 2200);
      }
    } finally {
      setDeferred(null);
    }
  }

  if (!visible) return null;

  const storeUrl = storeUrlFor(platform);
  const steps = stepsFor(platform);

  return (
    <div
      className={`pwi${leaving ? " pwi-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("app.pwi.ariaLabel")}
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
          <h2 className="pwi-title">{t("app.pwi.done.title")}</h2>
          <p className="pwi-sub">
            {t("app.pwi.done.a")} <b>{t("app.pwi.done.b")}</b> {t("app.pwi.done.c")}
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
            {t("app.pwi.title.a")} <span className="pwi-hi">{t("app.pwi.title.hi")}</span>
          </h2>
          <p className="pwi-sub pwi-in pwi-d2">
            {t(storeUrl ? "app.pwi.store.sub" : "app.pwi.sub")}
          </p>

          {storeUrl ? (
            /* The platform HAS a listing, so there is nothing left to teach:
               one link, and the OS takes over. `close()` fires on the way out
               so coming back from the store does not land on this overlay
               again -- the store visit is the answer to what it was asking. */
            <div className="pwi-cta pwi-in pwi-d3">
              <a
                className="pwi-install"
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v13" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                {t(platform === "ios" ? "app.pwi.store.ios" : "app.pwi.store.android")}
              </a>
              <button type="button" className="pwi-skip" onClick={close}>
                {t("app.pwi.skip")}
              </button>
            </div>
          ) : (
            <>
            <div className="pwi-demo pwi-in pwi-d3">
              <MiniPhone platform={platform} step={step} t={t} />

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
                      <span className="pwi-step-text">{stepText(platform, s.key, t)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>


            <div className="pwi-cta pwi-in pwi-d5">
              {deferred ? (
                <button type="button" className="pwi-install" onClick={onPrimary}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v13" />
                    <path d="m7 12 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  {t("app.os.installApp")}
                </button>
              ) : null}
              <button type="button" className="pwi-skip" onClick={close}>
                {t("app.pwi.skip")}
              </button>
            </div>
            </>
          )}
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
function MiniPhone({ platform, step, t }: { platform: Platform; step: number; t: TFunction }) {
  const lastIndex = stepsFor(platform).length - 1;
  return (
    <div className="pwi-phone" data-step={step} data-platform={platform}>
      <span className="pwi-notch" aria-hidden="true" />
      <div className="pwi-screen">
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
            <div className="pwi-row">{t("app.os.newTab")}</div>
            <div className="pwi-row pwi-target">
              <span>{t("app.os.installApp")}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m8 11 4 4 4-4" />
                <path d="M5 21h14" />
              </svg>
              <span className="pwi-tap" />
            </div>
            <div className="pwi-row">{t("app.os.history")}</div>
          </div>
        </div>

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
