/**
 * One deliberate pulse of feedback, fired at a moment the code chooses.
 *
 * This is the counterpart to `HapticProvider`, not a replacement for it: that
 * one is a delegated `touchstart` listener that gives every button a press
 * feel with no wiring, which covers taps and nothing else. A gesture has
 * moments a listener cannot see — the instant a pull crosses the point where
 * letting go acts — and those are what this exists for.
 *
 * Two layers, best-available-wins, both best-effort:
 *  1. Android / Chromium get a real buzz through the Vibration API.
 *  2. Everything gets the synthesised click, which is the only layer a current
 *    iPhone still hears (iOS has no Vibration API, and Apple patched the
 *    switch-input Taptic trick in iOS 26.5 — see `haptic-provider.tsx`). It
 *    goes through `playClick`, so the user's "click sound off" setting is
 *    honoured here exactly as it is everywhere else.
 *
 * Never throws and never awaits: feedback is a nicety, and a gesture that
 * failed because the buzz failed would be a strictly worse trade.
 */

import { playClick, type ClickTimbre } from "@/lib/feel/click-sound";

/** Buzz lengths (ms). Short enough to read as a detent, never as a rumble. */
const DURATION_MS: Record<ClickTimbre, number> = {
  tick: 6,
  stamp: 12,
};

export function pulse(timbre: ClickTimbre = "tick"): void {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(DURATION_MS[timbre]);
    }
  } catch {
    // Some browsers gate `vibrate` behind engagement heuristics and throw.
  }
  playClick(timbre);
}
