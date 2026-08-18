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
    /**
     * THE SIGN-IN HOSTS. Without this list, sign-in is broken inside the shell
     * in a way that looks like nothing at all in any log.
     *
     * Capacitor cancels every top-level navigation to a host that is not
     * `server.url` and hands the URL to the SYSTEM browser instead. That is
     * the right default — a support mail or a store link should not trap the
     * user inside our web view — but an OAuth handshake is not a link out. It
     * is a round trip: the provider signs the user in and redirects back to
     * `fitmess.app/auth/callback`, where the session cookie is set. Bounced
     * out to Safari, that whole round trip happens in Safari: the user really
     * is signed in — in the wrong browser — while the app sits on the login
     * screen it never left.
     *
     * That is what "Nastavi sa Google" did in the shell before this list
     * existed, and it is what Sign in with Apple would have done on the very
     * first tap an App Review reviewer gave it (guideline 2.1). Adding a
     * provider button to the site is therefore only half of adding a provider:
     * its host belongs here, and this file only reaches phones through a NEW
     * BINARY — unlike the site, which reaches them with a `git push`.
     *
     * `appleid.apple.com` — Sign in with Apple, required under guideline 4.8.
     * `accounts.google.com` + `accounts.youtube.com` — Google's consent screen
     * and the account-chooser hop it makes on the way.
     */
    allowNavigation: [
      /**
       * ⚠️ THE FIRST HOP, and the one that is easy to leave out — as it was in
       * build 4, which sent every sign-in tap straight to Safari even though
       * both providers below were already listed.
       *
       * The app never navigates to Apple or Google directly.
       * `supabase.auth.signInWithOAuth` sends the web view to Supabase's own
       * `/auth/v1/authorize`, which 302s onward to the provider; the provider
       * then posts back to `/auth/v1/callback` on this same host, which
       * finally redirects to `fitmess.app/auth/callback`. So this host is
       * crossed TWICE per sign-in, before and after the provider, and without
       * it the round trip is cancelled on its very first step.
       *
       * Hardcoded rather than read from `NEXT_PUBLIC_SUPABASE_URL`: this file
       * is evaluated by the Capacitor CLI on the build machine, where that
       * variable is not set — deriving it there would silently produce
       * `undefined` and reintroduce exactly this bug.
       */
      "femrzpfslejzqnvfsfoe.supabase.co",
      /**
       * Measured on 19.08.2026 by following the redirect chain the Supabase
       * authorize URL actually produces: Apple resolves to `appleid.apple.com`
       * and Google to `accounts.google.com`, nothing else.
       */
      "appleid.apple.com",
      "accounts.google.com",
      /**
       * Insurance, not measurement. The trace above can only see the hops
       * BEFORE credentials are entered; whatever a provider does afterwards
       * (two-factor, an account chooser, a consent interstitial) happens on
       * hosts no outside request can enumerate. A hop that lands outside this
       * list does not fail loudly — it silently hands the user to Safari, and
       * the cost of discovering that is another full build cycle. These
       * wildcards cover the providers' own domains only.
       */
      "*.apple.com",
      "*.google.com",
      "accounts.youtube.com",
    ],
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
    /**
     * `never`, because the SITE owns its safe areas — the bottom navigation
     * pads itself with `env(safe-area-inset-bottom)` and the app column pads
     * itself with `env(safe-area-inset-top)` (`app-shell.tsx`).
     *
     * It was `always`, and that inset the web view's own scroll view on top of
     * all of that. The app column is `h-dvh` with its own inner scroll region,
     * so WKWebView's scroll view never actually scrolls — the inset had
     * nothing to offset and simply became dead space under the bottom
     * navigation, on top of the padding the bar had already added itself.
     * Two owners of one inset; now there is one.
     */
    contentInset: "never",
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
