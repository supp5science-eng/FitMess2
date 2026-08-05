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
    <div className="shrink-0 border-t border-border/70 bg-background pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-4">
        <BottomNav />
        <AddSheet />
      </div>
    </div>
  );
}
