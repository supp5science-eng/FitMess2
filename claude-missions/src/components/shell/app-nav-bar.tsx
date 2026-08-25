"use client";

import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * Bottom navigation section: the glass tab pill, alone. It is its OWN row at
 * the bottom of the app column (not a floating overlay) — always visible, and
 * it can never overlap the content, which scrolls in the region above it (see
 * `AppShell`). A hairline top border sets it apart from the content as a
 * distinct section.
 *
 * Redesign 2026-08-25: the round "+" (AddSheet) moved OUT of this bar — with
 * only two tabs the bar reads as one centred pill, and logging is a floating
 * action on the AI tab (`AppShell` mounts it over the content region on
 * `/danas`).
 *
 * iOS standalone PWA: `env(safe-area-inset-bottom)` pads the section clear of
 * the home indicator; `viewport-fit=cover` (set in the root layout) lets the
 * background extend into the inset area.
 */
export function AppNavBar() {
  return (
    <div className="shrink-0 border-t border-border/70 bg-background pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="mx-auto flex w-full max-w-[430px] items-center px-4">
        <BottomNav />
      </div>
    </div>
  );
}
