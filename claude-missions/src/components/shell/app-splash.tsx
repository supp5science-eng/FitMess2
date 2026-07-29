"use client";

import { useEffect, useState } from "react";

import "./app-splash.css";

// Premium launch splash. The FitMess pear mark + "FitMess" wordmark (with the
// iridescent "Mess") animate in over `var(--background)` the moment the app
// boots, covering the otherwise-blank first paint on a PWA cold launch
// (`start_url: /danas`), then fade away on their own.
//
// It is rendered server-side inside the app column (`AppShell`), so it is part
// of the FIRST HTML paint -- the entrance AND exit run on pure CSS, needing no
// JavaScript, so the brand shows even before React hydrates. JS is used only to
// (a) stop it replaying on in-app navigations within the same session and
// (b) stay a no-op during SSR. A genuine cold launch is a fresh session, so it
// plays exactly when the user "enters the app," not on every soft navigation.

const SESSION_KEY = "fm_splash_shown";

/**
 * Show on SSR + the very first client paint of a cold load; skip on later
 * in-app (client-side) remounts within the same session. `window` is absent on
 * the server, and on a real cold load the session flag is not set yet, so both
 * of those render the splash and hydration matches.
 */
function shouldRenderInitially(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === null;
  } catch {
    return true;
  }
}

export function AppSplash() {
  const [render] = useState(shouldRenderInitially);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // No storage (private mode / disabled): the splash still plays this once;
      // it just isn't suppressed on later in-app navigations.
    }
  }, []);

  if (!render) return null;

  return (
    <div
      className="fm-splash"
      role="status"
      aria-live="polite"
      aria-label="FitMess se učitava"
    >
      <div className="fm-splash__stage" aria-hidden="true">
        {/* The pear mark used in the header lockup, at launch size. Decorative:
            the wordmark below already names the app. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="fm-splash__mark"
          src="/brand/fitmess-icon.png"
          alt=""
          width={96}
          height={96}
        />
        <div
          className="fm-splash__wordmark"
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          }}
        >
          Fit<span className="fm-wordmark-accent">Mess</span>
        </div>
      </div>
    </div>
  );
}
