import type { ExpoConfig } from "expo/config";

/**
 * The native app's configuration.
 *
 * TypeScript rather than `app.json` because the decisions below need their
 * reasons attached — particularly the identifier, which cannot be taken back.
 */

/**
 * ⚠️ PERMANENT, AND SHARED WITH THE APP ALREADY IN THE STORES.
 *
 * `app.fitmess` is the identifier the Capacitor shell shipped under. Apple
 * approved it on 23.08.2026 and Google Play is testing it. An identifier is
 * an app's identity in both stores: reusing it means this rebuild arrives as
 * an UPDATE to that app — same listing, same reviews, same installed base,
 * and every current user gets it without reinstalling. Changing it means a
 * second, separate app that starts from zero.
 *
 * Reuse is almost certainly what is wanted, and it is set that way here. But
 * it is still an OPEN DECISION (asked, not yet answered), so know what a build
 * does before running one:
 *
 *   - This config + a store submission REPLACES the live app for everyone.
 *   - A dev build or TestFlight build does NOT: it installs beside nothing and
 *     reaches only the phones you install it on. That is the safe way to look
 *     at this app, and it is what the current work is aimed at.
 *
 * If the answer turns out to be "build it alongside the old one", change this
 * one line to something like `app.fitmess.native` BEFORE the first store
 * submission — after it, the id is spent.
 */
const BUNDLE_ID = "app.fitmess";

/** The plate's paper and ink (`src/theme/tokens.ts`). Repeated as literals
 *  because this file is evaluated by the Expo CLI, outside the app's module
 *  graph and its `@/` path alias. */
const PAPER = "#ffffff";
const INK_BRIGHT = "#2f2ce6";

const config: ExpoConfig = {
  name: "FitMess",
  slug: "fitmess",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  /**
   * ONE theme, and it is a light one — the web app retired its dark palette on
   * 2026-08-24. Pinned so a phone in dark mode does not have the OS paint
   * native chrome (the keyboard, share sheets, the status bar backdrop) in a
   * world the app has no colours for.
   */

  /**
   * The deep-link scheme, and the reason sign-in with Google or Apple can work
   * at all. OAuth leaves the app for a system browser and has to come back;
   * `fitmess://` is the address it comes back to. It is also what a push
   * notification tap and a shared photo will use later.
   */
  scheme: "fitmess",

  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: PAPER,
  },

  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      /**
       * Permission strings are shown to the user verbatim, in Serbian, and
       * App Review rejects vague ones. Each says what FitMess does with the
       * thing, not that it "needs access".
       */
      NSCameraUsageDescription:
        "Kamera se koristi da slikaš obrok i da FitMess proceni šta je na tanjiru.",
      NSMicrophoneUsageDescription:
        "Mikrofon se koristi kada pričaš sa Jarvisom umesto da kucaš.",
      NSSpeechRecognitionUsageDescription:
        "Prepoznavanje govora pretvara ono što kažeš u tekst na samom telefonu, bez slanja snimka.",
      NSPhotoLibraryUsageDescription:
        "Galerija se koristi da izabereš već slikan obrok.",
    },
  },

  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: PAPER,
    },
    edgeToEdgeEnabled: true,
  },

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
        resizeMode: "contain",
        backgroundColor: PAPER,
      },
    ],
    /** The keychain the Supabase session is chunked into
     *  (`src/lib/supabase.ts`). */
    "expo-secure-store",
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    /** Filled in by `eas init` on first build. Left absent rather than
     *  guessed: a wrong project id points builds and OTA updates at someone
     *  else's project. */
  },
};

export default config;
