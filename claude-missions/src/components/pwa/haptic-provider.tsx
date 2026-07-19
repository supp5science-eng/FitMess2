"use client";

import { useEffect } from "react";

/**
 * App-wide tap feedback. A single delegated `touchstart` listener does two
 * jobs, for every tappable control (button, link, the bottom-nav tabs, or
 * anything `role="button"`), with zero per-button wiring:
 *
 *  1. Enables the CSS press-scale. iOS Safari only applies `:active` styles
 *     while SOME touch listener exists on the page — without one, the
 *     press-scale in `globals.css` never triggers on iPhone. This listener's
 *     mere presence fixes that, so it must be attached even when there is no
 *     Vibration API.
 *  2. Fires a tiny real vibration where supported. `navigator.vibrate` is
 *     ANDROID-ONLY (iOS exposes no Vibration API), so the buzz is a silent
 *     no-op on iPhone — where the visual press from job #1 carries the feel.
 *
 * Renders nothing; mounted once in the root layout.
 */

/** Controls that should buzz on press. */
const TAP_SELECTOR = 'button, a, [role="button"], summary';

/** Short, gentle buzz (ms) — enough to feel a tap, never a rumble. */
const TAP_DURATION_MS = 8;

function isDisabled(el: Element): boolean {
  return (
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("data-disabled")
  );
}

export function HapticProvider() {
  useEffect(() => {
    // Attached UNCONDITIONALLY: even with no Vibration API, the listener's
    // presence is what makes iOS Safari apply :active (the CSS press-scale).
    const canVibrate =
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function";

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(TAP_SELECTOR);
      if (!control || isDisabled(control)) return;
      if (!canVibrate) return;
      try {
        navigator.vibrate(TAP_DURATION_MS);
      } catch {
        // Some browsers gate vibrate behind engagement heuristics and throw;
        // a missing buzz is never worth surfacing an error for.
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => document.removeEventListener("touchstart", onTouchStart);
  }, []);

  return null;
}
