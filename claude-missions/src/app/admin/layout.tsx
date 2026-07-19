import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/admin";

/**
 * F033: the `/admin` area's server-side access boundary (AS-059, AS-067).
 *
 * Every route under `/admin/*` (this landing page today; F034's
 * hrana queue/editor, F036's korisnici, F075's troškovi later) is nested
 * under this layout, so `requireAdmin()` runs before ANY admin page's own
 * code does -- a non-admin visitor never reaches a page component's render
 * at all, regardless of whether that page remembers to check access itself.
 *
 * `requireAdmin()` redirects (and never returns) for a denied visitor, so
 * `children` is only ever reached once the current session has been proven
 * to belong to a `profiles.is_admin === true` user.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Persistent admin header: the /admin area is its own route group with
          no bottom nav, so without this the only way out was to close the app.
          Safe-area aware so the back link clears the iOS notch. */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <Link
          href="/danas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
        >
          <span aria-hidden="true">←</span> Nazad u aplikaciju
        </Link>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </span>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
