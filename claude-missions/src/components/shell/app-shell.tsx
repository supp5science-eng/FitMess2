"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * F005: app-wide mobile-first shell.
 *
 * - Mobile (<=430px, baseline 375px): the column fills the viewport width,
 *   no horizontal scroll (AS-125).
 * - Desktop (wide viewports): the outer wrapper spans the full width with a
 *   light neutral background, while the inner column stays clamped to the
 *   mobile max-width and is horizontally centered via `mx-auto` (AS-126).
 *
 * `min-h-dvh` + `flex-col` on the inner column means the bottom nav sits at
 * the bottom of the viewport on short pages and simply scrolls with content
 * (via `sticky bottom-0` on BottomNav) on tall pages.
 *
 * Full-bleed exception: the public marketing landing (`/`) is a full-width
 * page with its own chrome, so it opts out of the centered mobile column and
 * the bottom navigation entirely.
 *
 * Auth exception: the sign-in / sign-up screens (`/prijava`, `/registracija`,
 * ...) keep the centered mobile column but hide the bottom navigation — its
 * tabs (Danas / Nedelja / Agent / Profil) link into the authenticated app and
 * must not be visible or reachable before the user is signed in. When someone
 * installs the app or taps "Uđi", the first thing they see is only the auth
 * screen. Every other route keeps the full app shell (column + nav).
 */

/** Routes that render their own full-width layout, without the app column or
 * bottom navigation: the marketing landing page and the desktop "open on your
 * phone" gate (`/samo-za-telefon`). */
const FULL_BLEED_ROUTES = new Set(["/", "/samo-za-telefon"]);

/** Auth route prefixes that render inside the centered column but WITHOUT the
 * bottom navigation. Matched by prefix so nested steps (e.g.
 * `/registracija/proveri-email`) are covered too. */
const AUTH_ROUTE_PREFIXES = ["/prijava", "/registracija"] as const;

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname !== null && FULL_BLEED_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const showBottomNav = pathname === null || !isAuthRoute(pathname);

  return (
    <div className="min-h-dvh w-full bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-hidden bg-background shadow-sm">
        <div className="flex flex-1 flex-col">{children}</div>
        {showBottomNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
