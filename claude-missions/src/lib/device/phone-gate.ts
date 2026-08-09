import { isCrawlerUserAgent } from "@/lib/device/is-crawler";
import { isMobileUserAgent } from "@/lib/device/is-mobile";
import { isNativeAppUserAgent } from "@/lib/device/native";
import { isLegalPath } from "@/lib/legal/paths";

/**
 * The phone-only gate decision, framework-free so it can be tested directly.
 *
 * FitMess is designed and shipped for phones. Everyone else is redirected to
 * `/samo-za-telefon` ("open this on your phone") before the requested page
 * runs, so a desktop visit never triggers the app's data fetching.
 *
 * Three audiences are exempt, each for a reason that cost something to learn:
 *
 *  - **Phones**, obviously — the product.
 *  - **Crawlers**, because most fetch with a desktop-shaped UA and were being
 *    served a 307 for every URL, which is why fitmess.app went unindexed.
 *  - **The native shell**, because Apple reviews iPhone apps on an iPad, whose
 *    web view reports a "Macintosh" UA. A reviewer who taps the app icon and
 *    gets "open this on your phone" rejects the submission.
 *
 * And three *paths* are exempt for anyone at all: the legal documents
 * (`src/lib/legal/paths.ts`). Their entire job is to be opened by a stranger on
 * a desktop — a store reviewer clicking the privacy-policy link from the
 * listing. Gating them defeats the only reason they exist.
 *
 * Everyone exempt is served exactly what a phone visitor is served — the gate
 * is skipped and nothing else about the response changes.
 */

/** The phone-only gate route (see `src/app/samo-za-telefon/page.tsx`). */
export const PHONE_ONLY_PATH = "/samo-za-telefon";

export type PhoneGateDecision =
  /** Carry on into session + route-protection work. */
  | { action: "allow" }
  /** Desktop asking for the gate page itself: serve it, skip all session work. */
  | { action: "serve-gate" }
  | { action: "redirect"; to: string };

export function decidePhoneGate({
  pathname,
  userAgent,
}: {
  pathname: string;
  userAgent: string | null | undefined;
}): PhoneGateDecision {
  const allowed =
    isLegalPath(pathname) ||
    isMobileUserAgent(userAgent) ||
    isCrawlerUserAgent(userAgent) ||
    isNativeAppUserAgent(userAgent);
  const onGate = pathname === PHONE_ONLY_PATH;

  if (!allowed) {
    return onGate ? { action: "serve-gate" } : { action: "redirect", to: PHONE_ONLY_PATH };
  }
  // A phone (or the shell) that lands on the gate URL is bounced back into the
  // app — the gate is only ever meant for the audience that can't use it.
  if (onGate) return { action: "redirect", to: "/" };

  return { action: "allow" };
}
