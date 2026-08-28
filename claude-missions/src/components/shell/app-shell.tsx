"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppNavBar } from "@/components/shell/app-nav-bar";
import { AppSplash } from "@/components/shell/app-splash";
import { AccountsSync } from "@/components/auth/accounts-sync";
import { InstallNudge } from "@/components/pwa/install-nudge";
import { PushTapListener } from "@/components/native/push-tap-listener";

/**
 * F005: app-wide mobile-first shell.
 *
 * - Mobile (<=430px, baseline 375px): the column fills the viewport width,
 *   no horizontal scroll (AS-125).
 * - Desktop (wide viewports): the outer wrapper spans the full width with a
 *   light neutral background, while the inner column stays clamped to the
 *   mobile max-width and is horizontally centered via `mx-auto` (AS-126).
 *
 * The navigation (`AppNavBar`) is its OWN bottom section, not a floating
 * overlay: the column is exactly one viewport tall, the content area scrolls
 * INSIDE it, and the nav sits in the flow beneath it. So the bar is always
 * visible AND can never overlap or hide content — the last of the page always
 * clears it, with no magic bottom-padding to keep in sync. (Sticky sub-headers
 * inside a page still work: they stick within the content scroll container.)
 *
 * Full-bleed exception: the public marketing landing (`/`) and the desktop
 * "open on your phone" gate (`/samo-za-telefon`) are full-width pages with
 * their own chrome, so they opt out of the centered mobile column and the
 * bottom navigation entirely.
 *
 * Auth exception: the sign-in / sign-up screens (`/prijava`, `/registracija`,
 * ...) also render full-bleed — they own the whole viewport with their own
 * dark chrome (`src/app/(auth)/layout.tsx`) and must never expose the bottom
 * navigation, whose tabs (Danas / Nedelja / Profil) link into the
 * authenticated app. When someone installs the app or taps "Uđi", the first
 * thing they see is only the auth screen.
 *
 * Two modes, then: full shell (column + nav) and full-bleed (neither). Every
 * route not listed below gets the full shell.
 */

/** Routes that render their own full-width layout, without the app column or
 * bottom navigation: the marketing landing page and the desktop "open on your
 * phone" gate (`/samo-za-telefon`). */
const FULL_BLEED_ROUTES = new Set([
  "/",
  "/samo-za-telefon",
  // The public legal documents (`src/lib/legal/paths.ts`). Their reader is
  // usually signed out — often a store reviewer on a desktop — so the bottom
  // navigation would offer them four tabs that all end at a login screen. The
  // in-app copies at `/profil/privatnost` and `/profil/uslovi` keep the full
  // shell; these three are the public URLs the store listings point at.
  "/privatnost",
  "/uslovi",
  "/brisanje-naloga",
]);

/** Full-bleed route prefixes, covering nested steps by prefix match:
 * - auth (`/prijava`, `/registracija/proveri-email`, ...)
 * - klon (`/klon`): the public, pre-auth avatar screen -- the first thing a
 *   visitor meets after "Kreni", before the questionnaire, and owned by nobody
 *   with a bottom navigation yet.
 * - questionnaire (`/upitnik`): the public, pre-auth onboarding questionnaire
 *   + plan preview own the whole viewport, same as post-auth onboarding.
 * - onboarding (`/onboarding`, `/onboarding/pregled`): the questionnaire /
 *   plan reveal own the whole viewport and must NOT expose the bottom
 *   navigation — its tabs (Danas / Nedelja / Agent / Profil) only become
 *   available once onboarding is finished (`profiles.onboarded_at` set). */
const FULL_BLEED_PREFIXES = [
  "/prijava",
  "/registracija",
  "/klon",
  "/upitnik",
  "/onboarding",
  "/telefon",
  // `/en/*` — the same three legal documents in fixed English
  // (`src/app/en/layout.tsx`), read by the same signed-out audience as the
  // Serbian originals above, and full-bleed for the same reason.
  "/en",
] as const;

function isFullBleed(pathname: string): boolean {
  return (
    FULL_BLEED_ROUTES.has(pathname) ||
    FULL_BLEED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  );
}

export function AppShell({
  children,
  introActive = false,
}: {
  children: ReactNode;
  // The onboarding ring hand-off (`fm_intro` cookie, read server-side in the
  // root layout) plays its own full-screen brand animation on `/danas`; the
  // launch splash steps aside for it so the two never overlap.
  introActive?: boolean;
}) {
  const pathname = usePathname();

  if (pathname !== null && isFullBleed(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh w-full bg-muted">
      {/* Launch splash: a first-paint brand cover over the app column that
          dismisses itself. Suppressed during the onboarding hand-off. */}
      {introActive ? null : <AppSplash />}
      {/* `paddingTop` is the notch/Dynamic Island clearance for the whole
          column, so every screen inherits it instead of each header
          remembering. In a browser and in the installed PWA the inset is 0 and
          nothing moves; inside the App Store shell the web view really does
          span the camera cutout (`viewport-fit=cover` in `layout.tsx`), and
          without this the wordmark sits underneath it. `h-dvh` is
          border-box, so the column still ends exactly at the screen edge and
          the bottom navigation keeps its own `env(safe-area-inset-bottom)`.
          The full-bleed routes returned above (onboarding, questionnaire,
          auth) pad themselves and never reach here, so nothing double-counts. */}
      <div
        className="relative isolate mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-x-hidden bg-background shadow-sm"
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* App aurora: a barely-there iridescent wash in the corners, behind
            all content. `isolate` on the column makes it a stacking context, so
            this `-z-10` layer paints above the white/near-black background but
            below every child — the colour only shows in the negative space
            between cards. Decorative, so it's inert and hidden from a11y. */}
        <div
          aria-hidden="true"
          className="app-aurora pointer-events-none absolute inset-0 -z-10"
        />
        {/* Content scrolls inside this region only; where the nav is rendered
            it keeps its own space below, so nothing ever hides behind it. */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {children}
        </div>
        <AppNavBar />
      </div>
      {/* Keeps the on-device multi-account registry (and the active account's
          rotating token) up to date wherever a signed-in user is. */}
      <AccountsSync />
      {/* Asks browser-tab users to install the app, once per visit. Self-gating
          (silent when already installed, on a repeat visit, or mid-logging). */}
      <InstallNudge />
      {/* Store app only: routes a tapped reminder to the screen it is about.
          Inert in every browser, where the service worker does this instead. */}
      <PushTapListener />
    </div>
  );
}
