import type { ReactNode } from "react";

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
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-hidden bg-background shadow-sm">
        <div className="flex flex-1 flex-col">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
