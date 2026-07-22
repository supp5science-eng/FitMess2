/**
 * iOS-picker-style detent feedback for the scroll pickers: a short "tick"
 * click + a tiny haptic buzz, fired each time a new value snaps under the
 * center. Client-only and best-effort — no-ops on SSR, in jsdom, or where the
 * Web Audio / Vibration APIs are missing or gated.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  // Autoplay policy suspends the context until a gesture; scrolling is one, so
  // resuming here (lazily, on first tick) is allowed.
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** Fire one detent tick: a soft descending click plus a ~6ms haptic pulse. */
export function tickFeedback() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(6);
    }
  } catch {
    // Some browsers gate vibrate behind engagement heuristics and throw.
  }

  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.03);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Never worth surfacing — a missing tick just degrades silently.
  }
}
