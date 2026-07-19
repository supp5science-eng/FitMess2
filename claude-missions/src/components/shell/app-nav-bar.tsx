"use client";

import { AddSheet } from "@/components/home/add-sheet";
import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * Floating bottom navigation bar: the dark frosted-glass tab pill plus a
 * separate round "+" trigger to its right, both pinned to the bottom of the
 * viewport and always visible over scrolling content (MacroFactor-style).
 *
 * The outer layer is `pointer-events-none` so the transparent gutters around
 * the bar never swallow taps meant for the content behind it; only the pill
 * and the "+" button re-enable pointer events.
 *
 * iOS standalone PWA: `env(safe-area-inset-bottom)` lifts the bar clear of the
 * home indicator; `viewport-fit=cover` (set in the root layout) lets it float
 * over the inset area.
 */
export function AppNavBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="mx-auto flex w-full max-w-[430px] items-center gap-3 px-4">
        <BottomNav />
        <AddSheet />
      </div>
    </div>
  );
}
