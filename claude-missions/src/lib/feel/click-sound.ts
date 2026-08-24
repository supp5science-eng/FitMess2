/**
 * The click, as a sound.
 *
 * FitMess had three layers of tap feedback and lost the only one that worked
 * on an iPhone: `navigator.vibrate` is Android-only, and the switch-input
 * Taptic trick that stood in for it was patched shut by Apple in iOS 26.5. On
 * a current iPhone — the phone this app is mostly used on — a tap has been
 * carrying nothing but a CSS scale for a while now.
 *
 * So: sound. It is the one layer that works in every browser, in the PWA and
 * inside the native shell, and it ships with a `git push` rather than with a
 * new binary and a store review.
 *
 * NOTHING IS LOADED. Both timbres are synthesised at press time out of an
 * oscillator and a noise buffer, which is not a stunt — an audio file would be
 * a network request on the first tap of a cold app, a cache entry to
 * invalidate, and a decode. This costs a few hundred bytes of code and is
 * instant offline.
 *
 * Two timbres, and the split is the same one the ink glass makes: controls
 * filled with ink (`bg-primary` — the big actions, the "+") land with `stamp`,
 * a short low thud like a seal pressed into paper; everything else gets
 * `tick`, dry and out of the way. So the weight of the sound matches the
 * weight of the action, and the app has exactly two, not one per screen.
 *
 * Volume is deliberately low. This fires on every tap of a food diary — a
 * sound that is charming at tap five is unbearable at tap five hundred, which
 * is also why `MIN_GAP_MS` exists and why the whole thing can be switched off
 * in Podešavanja.
 */

export type ClickTimbre = "tick" | "stamp";

/** Per-device preference. Absent means on; only the literal "off" disables. */
const STORAGE_KEY = "fm_click_sound";

/**
 * Two taps closer together than this share one sound. Real double-taps and
 * fast scroll-then-tap sequences otherwise stack into a rattle.
 */
const MIN_GAP_MS = 45;

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

export function isClickSoundOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Private mode / storage blocked: default to on rather than silently mute.
    return true;
  }
}

export function setClickSoundOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // A preference we cannot persist still applies for this session.
  }
  for (const listener of listeners) listener();
}

/**
 * The preference as an external store, so the settings switch can read it with
 * `useSyncExternalStore` instead of copying it into React state inside an
 * effect. `localStorage` is exactly what that hook is for: state that lives
 * outside React, is unavailable while rendering on the server, and can change
 * from more than one place.
 */
const listeners = new Set<() => void>();

export function subscribeClickSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What the server renders: on, the default, so the markup matches the common
 * case and only someone who has muted the app sees the switch correct itself. */
export function getClickSoundServerSnapshot(): boolean {
  return true;
}

/**
 * The shared AudioContext, built on the first press and never before.
 *
 * Browsers refuse to start audio outside a user gesture, and a context created
 * at import time would be born `suspended` and stay that way. Everything here
 * is called from a `touchstart` handler, which is the gesture.
 */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * `tick` — a 30 ms burst of noise squeezed through a narrow band-pass around
 * 2.6 kHz. That is what a small hard switch actually is: broadband, brief, no
 * pitch. A pure tone at this length reads as a beep, which sounds like an
 * error; noise reads as a mechanism.
 */
function tick(c: AudioContext): void {
  const t = c.currentTime;
  const length = Math.floor(c.sampleRate * 0.03);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  // A steep exponential envelope baked into the samples: all the energy is in
  // the first few milliseconds, so the tail never smears into the next tap.
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 14);
  }

  const source = c.createBufferSource();
  source.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2600;
  band.Q.value = 1.1;

  const gain = c.createGain();
  gain.gain.value = 0.22;

  source.connect(band);
  band.connect(gain);
  gain.connect(c.destination);
  source.start(t);
}

/**
 * `stamp` — a triangle dropping from 260 Hz to 92 Hz in 60 ms behind a
 * low-pass, i.e. the thud of something landing rather than clicking. The pitch
 * fall is what makes it read as weight; the low-pass keeps it from clacking.
 */
function stamp(c: AudioContext): void {
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(92, t + 0.06);

  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 900;

  const gain = c.createGain();
  // Exponential ramps cannot touch zero, hence the 0.0001 floor at both ends.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  osc.connect(low);
  low.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.11);
}

/**
 * Play one press. Safe to call from any handler: every reason not to make a
 * sound (switched off, backgrounded, no Web Audio, too soon after the last
 * one) is answered here rather than at each call site.
 */
export function playClick(timbre: ClickTimbre = "tick"): void {
  if (!isClickSoundOn()) return;
  if (typeof document !== "undefined" && document.hidden) return;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;

  const c = audio();
  if (!c) return;
  try {
    if (timbre === "stamp") stamp(c);
    else tick(c);
  } catch {
    // A tap must never fail because the audio graph did.
  }
}
