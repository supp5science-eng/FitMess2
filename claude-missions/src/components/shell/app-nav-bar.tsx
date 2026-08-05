"use client";

import { AddSheet } from "@/components/home/add-sheet";
import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * Bottom navigation section: the dark frosted-glass tab pill plus a separate
 * round "+" trigger to its right. It is its OWN row at the bottom of the app
 * column (not a floating overlay) — always visible, and it can never overlap
 * the content, which scrolls in the region above it (see `AppShell`). A hairline
 * top border sets it apart from the content as a distinct section.
 *
 * iOS standalone PWA: `env(safe-area-inset-bottom)` pads the section clear of
 * the home indicator; `viewport-fit=cover` (set in the root layout) lets the
 * background extend into the inset area.
 */
export function AppNavBar() {
  return (
    // The bar's own strip is translucent (2026-08-05): the nav pill inside it
    // was already frosted glass, but it sat on an OPAQUE `bg-background` band
    // that cut a hard white line across the bottom of the wallpaper. Blurring
    // the strip lets the ground run under the whole bar, so the pill reads as
    // floating on the page instead of parked on a shelf.
    <div className="shrink-0 border-t border-border/50 bg-background/55 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-4">
        <BottomNav />
        <AddSheet />
      </div>
    </div>
  );
}
