"use client";

import { useEffect } from "react";

/**
 * App-wide tap feedback. A single delegated `touchstart` listener gives every
 * tappable control (button, link, the bottom-nav tabs, or anything
 * `role="button"`) a real physical "click" feel, with zero per-button wiring.
 * Renders nothing; mounted once in the root layout.
 *
 * Three things happen, best-available-wins:
 *  1. The listener's mere presence makes iOS Safari apply `:active`, which is
 *     what drives the CSS press-scale in `globals.css` (without any touch
 *     listener, iOS never fires `:active`, so the press looked dead on iPhone).
 *  2. Android / Chromium: a tiny `navigator.vibrate()` buzz.
 *  3. iOS (no Vibration API): the "switch-input" haptic trick — toggling a
 *     hidden `<input type="checkbox" switch>` fires the Taptic Engine. This
 *     works on iOS 17.4–26.4; Apple patched it in iOS 26.5, so the newest
 *     iPhones fall back to the visual press from #1. Harmless everywhere else.
 */

/** Controls that should give feedback on press. */
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

/**
 * Builds the hidden `<label><input type="checkbox" switch></label>` whose
 * toggle fires iOS's Taptic Engine, and returns a `{ fire, cleanup }` pair.
 * The control is rendered but fully transparent + inert (NOT `display:none` —
 * the engine needs it in the render tree) and `pointer-events:none` so it can
 * never intercept a real tap; `label.click()` toggles it programmatically.
 */
function createSwitchHaptic(): { fire: () => void; cleanup: () => void } {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.position = "fixed";
  label.style.top = "0";
  label.style.left = "0";
  label.style.width = "1px";
  label.style.height = "1px";
  label.style.opacity = "0";
  label.style.pointerEvents = "none";
  label.style.zIndex = "-1";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);

  document.body.appendChild(label);

  return {
    fire: () => {
      try {
        label.click();
      } catch {
        // Never worth surfacing — a missing haptic just degrades to the visual
        // press.
      }
    },
    cleanup: () => label.remove(),
  };
}

export function HapticProvider() {
  useEffect(() => {
    const canVibrate =
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function";

    // Only build the iOS switch element when there is no Vibration API (i.e.
    // iPhone) — everywhere else `navigator.vibrate` is the cleaner path.
    const switchHaptic = canVibrate ? null : createSwitchHaptic();

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(TAP_SELECTOR);
      if (!control || isDisabled(control)) return;

      if (canVibrate) {
        try {
          navigator.vibrate(TAP_DURATION_MS);
        } catch {
          // Some browsers gate vibrate behind engagement heuristics and throw.
        }
        return;
      }

      // iOS: fire the switch-input haptic (synchronously, inside the user
      // gesture, as the Taptic Engine requires).
      switchHaptic?.fire();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      switchHaptic?.cleanup();
    };
  }, []);

  return null;
}
