"use client";

import { useEffect } from "react";

/**
 * App-wide tap haptics. A single delegated `pointerdown` listener fires a tiny
 * vibration whenever a tappable control (button, link, the bottom-nav tabs, or
 * anything `role="button"`) is pressed — so a tap feels physical, not just
 * visual. Renders nothing; mounted once in the root layout.
 *
 * `navigator.vibrate` is ANDROID-ONLY: iOS Safari / installed iOS PWAs expose
 * no Vibration API at all, so on iPhone this is a deliberate silent no-op and
 * the CSS press-scale in `globals.css` carries the "click" feel instead. Doing
 * it here (event delegation) rather than per-button means every current and
 * future control gets it with zero extra wiring.
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
    if (
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    ) {
      // No Vibration API (iOS + some desktop browsers): nothing to attach.
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(TAP_SELECTOR);
      if (!control || isDisabled(control)) return;
      try {
        navigator.vibrate(TAP_DURATION_MS);
      } catch {
        // Some browsers gate vibrate behind engagement heuristics and throw;
        // a missing buzz is never worth surfacing an error for.
      }
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
