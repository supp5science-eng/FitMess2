import type { CapacitorConfig } from "@capacitor/cli";

import { NATIVE_UA_SUFFIX } from "./src/lib/device/native";

/**
 * The native shell that carries FitMess into the App Store and Google Play.
 *
 * This is a "remote" Capacitor app: instead of bundling web files inside the
 * binary, the web view loads https://fitmess.app directly. That is not a
 * shortcut — FitMess is a Next.js app with server rendering, middleware, auth
 * and server actions, so there is no static bundle to ship. See
 * `docs/izlazak-u-store.md` for why rewriting it into a client-only app was
 * measured and rejected.
 *
 * What it buys, and it is the whole reason the decision holds: the content of
 * the store app IS the site. A `git push` reaches everyone who already
 * installed it, with no new submission and no review. The binary below only
 * goes back to the stores when something native changes — a plugin, the icon,
 * a permission. A few times a year.
 *
 * What it costs: the first screen waits for the network (softened by the
 * native splash and by `public/sw.js`, which already caches JS/CSS), and there
 * is no offline mode. Neither is a step back — today's PWA behaves the same.
 */
const config: CapacitorConfig = {
  /**
   * PERMANENT. The bundle identifier can never be changed once either store
   * has accepted a build: a different id is a different app, with its own
   * listing, its own reviews and its own install base. Reverse-DNS of the
   * domain we own.
   */
  appId: "app.fitmess",
  /** The name under the icon on the home screen. */
  appName: "FitMess",

  /**
   * Required by the CLI even though nothing here is served: with `server.url`
   * set, the web view always loads the remote site. The folder holds the
   * offline fallback page and exists so `cap sync` has something to copy.
   */
  webDir: "capacitor/www",

  server: {
    url: "https://fitmess.app",
    /**
     * Android's web view defaults to a custom `capacitor://` scheme for local
     * files. Serving over https keeps the origin consistent with the site, so
     * cookies, the service worker and `getUserMedia` (which refuses anything
     * but a secure context) all behave exactly as they do in Chrome.
     */
    androidScheme: "https",
  },

  /**
   * The marker that tells our own server and client code they are inside the
   * shell — imported, never retyped, so the two halves cannot drift apart.
   * `src/lib/device/native.ts` explains what breaks when they do.
   *
   * Detection matches the token anywhere in the UA, so it survives Capacitor's
   * own spacing quirks (iOS appended two spaces before 8.0).
   */
  appendUserAgent: NATIVE_UA_SUFFIX,

  ios: {
    /** Apple rejects apps that hide content behind the home indicator; the
     * site already handles safe areas via `env(safe-area-inset-*)`. */
    contentInset: "always",
    /** Links to anything that is not fitmess.app (support mail, store pages)
     * open in the system browser rather than trapping the user in our shell. */
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    /** The site is https-only; there is no cleartext traffic to permit. */
    allowMixedContent: false,
  },
};

export default config;
