/**
 * "Once a day", for the two moments the home screen is allowed to speak in
 * (`plan-intro.tsx` and `over-notice.tsx`).
 *
 * Both were built on a single mechanism: the server arms them from a day-keyed
 * cookie (`fm_plan` / `fm_over`) that the component burns the instant it
 * mounts. That is the right way to ARM a moment -- a new day re-arms it on its
 * own, nothing has to be timed to midnight -- but it turned out to be a poor
 * way to REMEMBER one.
 *
 * The bug it produced (reported 2026-08-09): the plan moment played on every
 * single return to the Početna tab, not once a day. The arming decision is
 * computed on the server and travels to the browser inside an RSC payload, and
 * the client router is free to hold on to that payload and render it again on
 * a later navigation. A payload produced BEFORE the cookie existed says "play
 * it" forever, however many times the cookie is written afterwards. Tapping
 * Analitika and coming back replayed a full-screen sheet the user had already
 * dismissed.
 *
 * So the record of "this already played" is kept here, on the device, where it
 * cannot be re-served by a cache. Two layers, because there are two different
 * ways to come back to the screen:
 *
 *  * `hasPlayedInSession` -- module scope, so it survives every client-side
 *    navigation inside the tab. It is checked DURING RENDER, which is what
 *    keeps a replay from painting even one frame; it is also hydration-safe,
 *    because on a fresh page load this module starts empty, which is exactly
 *    the state the server assumed when it rendered the sheet.
 *  * `playedBeforeThisLoad` -- `localStorage` as it stood when the tab loaded,
 *    which survives a reload or an app relaunch. This is the layer that covers
 *    a cookie that never made it back to the server at all.
 *
 * ⚠️ `playedBeforeThisLoad` answers about the moment the TAB LOADED and is
 * frozen there for the life of the tab, deliberately. It is read during render
 * (through `useSyncExternalStore`, so the server and the hydration pass both
 * see `false` and agree with the HTML), and a value that could flip mid-play
 * would make the moment hide itself half-way through its own animation --
 * `markPlayed` writes storage without disturbing it.
 *
 * ⚠️ Nothing here may keep state on the server: a module-level record there is
 * shared by every request and therefore by every user. Every function is inert
 * and non-caching without a `window`.
 */

/** momentKey -> the day it last played for, in this tab. */
const playedInSession = new Map<string, string>();

/** momentKey -> what `localStorage` held when this tab first asked. Read once,
 * never revised; see the warning above. */
const recordAtLoad = new Map<string, string | null>();

/** Every moment key this module has been asked about, so the test reset below
 * can clear the storage side too without hard-coding the callers' keys. */
const knownKeys = new Set<string>();

export function hasPlayedInSession(momentKey: string, dayKey: string): boolean {
  knownKeys.add(momentKey);
  return playedInSession.get(momentKey) === dayKey;
}

export function playedBeforeThisLoad(
  momentKey: string,
  dayKey: string
): boolean {
  // No window: server render. Answer "no" and cache nothing.
  if (typeof window === "undefined") return false;
  knownKeys.add(momentKey);
  if (!recordAtLoad.has(momentKey)) {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(momentKey);
    } catch {
      // Storage blocked (private mode, locked-down browser): fall back to the
      // session layer. A moment that repeats after a reload is a small loss; a
      // crash on the home screen is not.
      stored = null;
    }
    recordAtLoad.set(momentKey, stored);
  }
  return recordAtLoad.get(momentKey) === dayKey;
}

/** `useSyncExternalStore` needs a subscription; there is nothing to subscribe
 * to here, because the snapshot is fixed for the life of the tab by design. */
export function subscribeToNothing(): () => void {
  return () => {};
}

export function markPlayed(momentKey: string, dayKey: string): void {
  if (typeof window === "undefined") return;
  knownKeys.add(momentKey);
  playedInSession.set(momentKey, dayKey);
  try {
    window.localStorage.setItem(momentKey, dayKey);
  } catch {
    // See above -- the in-tab record still holds for this session.
  }
}

/**
 * Test-only. Module state outlives the renders inside a test file, so without
 * this the first test to play a moment would silently mute it for every test
 * after it. Called from `vitest.setup.ts` after each test.
 */
export function resetPlayedMoments(): void {
  playedInSession.clear();
  recordAtLoad.clear();
  if (typeof window !== "undefined") {
    try {
      knownKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
  knownKeys.clear();
}
