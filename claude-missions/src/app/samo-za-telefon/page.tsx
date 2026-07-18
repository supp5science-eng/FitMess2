import type { Metadata } from "next";

import { DesktopGate } from "@/components/shell/desktop-gate";

/**
 * The phone-only gate route.
 *
 * FitMess is a phone-only app. The middleware (`src/middleware.ts`) redirects
 * every non-mobile visitor here — for any route — before the requested page
 * ever runs, so desktop visitors never trigger the app's data fetching and
 * never see the mobile-only layout. Mobile visitors are redirected away from
 * this route back into the app.
 *
 * Rendered full-bleed (see `FULL_BLEED_ROUTES` in
 * `src/components/shell/app-shell.tsx`): no mobile column, no bottom nav.
 */
export const metadata: Metadata = {
  title: "Otvori na telefonu",
  robots: { index: false, follow: false },
};

export default function PhoneOnlyPage() {
  return <DesktopGate />;
}
