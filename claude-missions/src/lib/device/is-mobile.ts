/**
 * Server-side "is this a phone?" check, driven purely by the request
 * User-Agent header.
 *
 * FitMess is a phone-only product: the desktop/web experience is deliberately
 * replaced by a "open it on your phone" gate (see
 * `src/components/shell/desktop-gate.tsx`), so this decision is made on the
 * server, before any app UI renders, to avoid a flash of the (unsupported)
 * desktop layout.
 *
 * We match phones only. Tablets and desktops fall through to the gate — the
 * product is designed and tested for a phone-sized viewport, and iPadOS
 * Safari reports a desktop ("Macintosh") UA anyway, so there is no reliable
 * "tablet" bucket worth carving out here.
 *
 * Note: Android phones include the literal token "Mobile" in their UA while
 * Android tablets omit it; matching "Android" keeps both on the app path,
 * which is acceptable for a mobile-first layout.
 */
const MOBILE_UA = /Android|iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini|Mobile Safari|webOS/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA.test(userAgent);
}
