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
const BUNDLE_ID_PRODUCTION = "app.fitmess";

/**
 * ⚠️ THE DEV BUILD MUST NOT SHARE THE PRODUCTION IDENTIFIER. Learned on the
 * first install, 30.08.2026.
 *
 * A bundle identifier is not a name, it is an app's IDENTITY. The phone that
 * already carries the App Store build answered the dev build with "FitMess is
 * already installed" — because to iOS it was not a second app, it was the same
 * app arriving from somewhere else. The only choices on offer were to replace
 * the live app or to give up.
 *
 * A separate id gives the two apps two icons, two keychains and two sets of
 * data, and the store build keeps working while we break things next to it.
 *
 * The second gain is bigger than the first: `eas build` syncs a bundle id's
 * capabilities to whatever this config declares, and on 30.08.2026 it asked
 * Apple to switch OFF push and Sign in with Apple on the live identifier. It
 * was refused by luck. Pointed at `app.fitmess.dev`, that sync can only ever
 * shape an identifier nothing depends on.
 *
 * ⚠️ Push and Sign in with Apple are granted PER IDENTIFIER. When the native
 * app grows either, `app.fitmess.dev` needs its own capability and its own
 * APNs key — the production ones do not reach it, and that is the point.
 */
const BUNDLE_ID_DEV = "app.fitmess.dev";

/** Set by the `development` build profile in eas.json, and by nothing else. */
const IS_DEV = process.env.APP_VARIANT === "development";

const BUNDLE_ID = IS_DEV ? BUNDLE_ID_DEV : BUNDLE_ID_PRODUCTION;

/** The plate's paper (`src/theme/tokens.ts`). Repeated as a literal
 *  because this file is evaluated by the Expo CLI, outside the app's module
 *  graph and its `@/` path alias. */
const PAPER = "#ffffff";

const config: ExpoConfig = {
  /** The label under the icon. Both apps sit on the same home screen, so the
   *  dev one says so — otherwise the wrong icon gets opened and the bug hunt
   *  starts in the app that was never rebuilt. */
  name: IS_DEV ? "FitMess dev" : "FitMess",
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
  /**
   * ⚠️ Separate for the dev build, for the same reason the identifier is: iOS
   * lets two installed apps claim one scheme and then picks between them by no
   * rule anyone can rely on. An OAuth redirect that lands in the wrong FitMess
   * fails in the way that costs the most time — silently, and only sometimes.
   */
  scheme: IS_DEV ? "fitmessdev" : "fitmess",

  icon: "./assets/images/icon.png",
  // No top-level `splash` block: from SDK 57 the splash screen is configured
  // ONLY through the `expo-splash-screen` plugin below. A `splash` key here is
  // now a type error rather than a silently ignored one — which is the better
  // failure, since two places configuring one screen is how they drift.

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
        "Mikrofon se koristi kada izgovoriš unos umesto da ga kucaš.",
      NSSpeechRecognitionUsageDescription:
        "Prepoznavanje govora pretvara ono što kažeš u tekst na samom telefonu, bez slanja snimka.",
      NSPhotoLibraryUsageDescription:
        "Galerija se koristi da izabereš već slikan obrok.",

      /**
       * "We use no encryption beyond what Apple already exempts" — HTTPS is
       * exempt, and that is all this app does.
       *
       * ⚠️ Absent, this is not an error anywhere: the build succeeds, uploads,
       * and then sits in TestFlight as "Missing Compliance", undeliverable to
       * any tester until someone answers the question by hand in App Store
       * Connect. It cost us that exact hour in August on the Capacitor shell.
       */
      ITSAppUsesNonExemptEncryption: false,
    },

    /** See the `updates` block below. `appVersion` ties the JS an OTA update
     *  may replace to the binary's `version`, so a build can never be handed a
     *  bundle compiled against native code it does not contain. */
    runtimeVersion: { policy: "appVersion" },
  },

  /**
   * EAS Update — the reason this rebuild does not cost us "git push and
   * everyone has it".
   *
   * A new JS bundle reaches every installed app without a store review, the
   * same boundary Capacitor had: change JS, it ships; change native code (a
   * library, a permission, an icon), it needs a new binary. The build profile
   * picks which stream an app listens to via `channel` in eas.json.
   *
   * ⚠️ Installed BEFORE the first build on purpose. `expo-updates` is native
   * code, so adding it later would mean throwing that binary away and building
   * again — and the profiles already name channels that would silently do
   * nothing until it existed.
   */
  updates: {
    url: "https://u.expo.dev/ff4f721b-1999-4bfa-9416-9163df96e07c",
  },

  android: {
    package: BUNDLE_ID,
    /** Same reason as `ios.runtimeVersion`. */
    runtimeVersion: { policy: "appVersion" },
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: PAPER,
    },
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
    /** Required as a plugin from SDK 57 — `expo install` asked for it by name
     *  and could not add it itself, because this config is TypeScript rather
     *  than `app.json`. */
    "expo-status-bar",
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      /** Napisao `eas init --account marko212` 29.08.2026.
       *
       *  ⚠️ Ovo NIJE pogodjeno i ne sme da se menja rucno. Pogresan id salje
       *  buildove i OTA update-ove u tudji projekat, i to bez ijedne greske --
       *  build prodje, samo zavrsi kod nekog drugog.
       *
       *  `eas init` ume sam da upise ovo polje samo u `app.json`. Ova
       *  konfiguracija je TypeScript, pa komanda javi "Cannot automatically
       *  write to dynamic config" i ostavi ID na ekranu. To nije greska nego
       *  ocekivano; ID se prepisuje ovde. */
      projectId: "ff4f721b-1999-4bfa-9416-9163df96e07c",
    },
  },
};

export default config;
