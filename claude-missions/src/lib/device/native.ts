/**
 * "Are we running inside the FitMess native shell?" — the single source of
 * truth for that question, on both the server and the client.
 *
 * FitMess ships to the App Store and Google Play as a Capacitor shell that
 * loads `https://fitmess.app` in a native web view (see
 * `docs/izlazak-u-store.md`). The web app is otherwise byte-identical to what
 * a browser gets, so the ONLY way either side can tell the two apart is a
 * marker the shell appends to its User-Agent.
 *
 * That makes this file load-bearing in a way that is easy to miss: the string
 * below must match, exactly, what the Capacitor config tells the web view to
 * append. Both sides import `NATIVE_UA_SUFFIX` rather than re-typing it, so a
 * rename can never silently split them — a shell whose marker stops matching
 * would be treated as a plain browser and would hit the phone gate, the
 * "install to your Home Screen" overlays, and the Web Push dead end all at
 * once.
 *
 * Detection is UA-only on purpose. It has to work in `middleware.ts`, before
 * any page renders and before any JavaScript from us has run, which rules out
 * asking Capacitor's own runtime (`Capacitor.isNativePlatform()`) — that only
 * exists once the page is already executing.
 */

/** Product name in the UA marker. Kept separate so the check below can match
 * any shell version, while the suffix pins the one this build ships. */
const NATIVE_UA_TOKEN = "FitMessApp";

/**
 * Exactly what the native shell appends to the web view's User-Agent.
 *
 * The version here is the *shell's*, not the web app's: it changes only when a
 * new binary goes to the stores, which is a handful of times a year. It is not
 * used for any decision today — it exists so that when a future native feature
 * needs "is this shell old enough to lack X?", the answer is already in every
 * request we have ever logged.
 */
export const NATIVE_UA_SUFFIX = `${NATIVE_UA_TOKEN}/1.0`;

/**
 * Server-side check, from a request's `user-agent` header.
 *
 * Used by the middleware to exempt the native shell from the phone-only gate:
 * Apple reviews iPhone apps on an iPad, whose web view reports a desktop-shaped
 * ("Macintosh") UA, so without this the reviewer would be shown
 * `/samo-za-telefon` instead of the app and would reject the submission.
 */
export function isNativeAppUserAgent(
  userAgent: string | null | undefined
): boolean {
  if (!userAgent) return false;
  return userAgent.includes(NATIVE_UA_TOKEN);
}

/**
 * Client-side counterpart, for components that must not offer browser-only
 * affordances inside an installed app — "add to Home Screen" walkthroughs,
 * the install nudge, anything that assumes a browser tab.
 *
 * Returns `false` during server rendering, so anything gated on this must
 * tolerate a first paint as the non-native branch (in practice these are all
 * overlays that appear on a delay anyway).
 */
export function isNativeApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return isNativeAppUserAgent(navigator.userAgent);
}
