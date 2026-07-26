"use client";

import { usePathname } from "next/navigation";

import { InstallOverlay } from "@/components/pwa/install-overlay";

/**
 * The app-wide "you're still in a browser tab" install nudge.
 *
 * Mounted once in the app shell, so every visit to any signed-in screen can
 * raise the install walkthrough again -- not just the single post-onboarding
 * moment. `InstallOverlay` in `revisit` mode owns the actual decision (already
 * installed? new visit?); this wrapper only answers the one question the
 * overlay can't see: *is now a rude time to ask*.
 *
 * Suppressed routes:
 *  - `/dodaj/*` -- the logging flows. These open the camera, record audio, and
 *    run timed AI confirmation steps (Gric auto-saves on a countdown); a
 *    full-screen modal landing mid-capture costs the user an actual meal entry,
 *    which is far more expensive than a missed install pitch.
 *
 * Everything else -- Početna, Analitika, Navike, Podešavanja -- is fair game.
 * The auth screens, the questionnaire and onboarding never reach here at all:
 * the shell renders those full-bleed, without this subtree.
 */

/** Route prefixes where an interrupting modal would cost the user real work. */
const BUSY_PREFIXES = ["/dodaj"] as const;

function isBusyRoute(pathname: string): boolean {
  return BUSY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function InstallNudge() {
  const pathname = usePathname();

  if (pathname !== null && isBusyRoute(pathname)) return null;

  return <InstallOverlay mode="revisit" />;
}
