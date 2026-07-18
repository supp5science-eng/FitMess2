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

  return <>{children}</>;
}
