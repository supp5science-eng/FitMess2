/**
 * Where FitMess can actually be downloaded from, per platform.
 *
 * One file, because "is this store live yet?" is a question three different
 * screens ask (the install overlay, the landing availability strip, and any
 * future "get the app" link), and three copies of the answer would drift the
 * day one of them goes live.
 */

/**
 * The App Store listing. LIVE since 23.08.2026 (v1.0).
 *
 * The numeric id is the app's Apple ID, the same one `codemagic.yaml` passes
 * as `APP_STORE_APP_ID` when it asks App Store Connect for the latest build
 * number -- so if that ever changes, it changes in both places or neither.
 *
 * No country segment on purpose: `apps.apple.com/app/id...` resolves to
 * whatever storefront the visitor's account belongs to. Pinning `/rs/` would
 * show a Serbian expat in Germany a page they cannot buy from.
 */
export const APP_STORE_URL = "https://apps.apple.com/app/id6801093936";

/**
 * Google Play — DELIBERATELY NULL, and this is not an oversight.
 *
 * Play still requires 12 testers to run a closed test for 14 consecutive days
 * before a new personal-developer app may be promoted to production
 * (`docs/izlazak-u-store.md` §6). Until that finishes there is no public
 * listing: a link would land on "Stavka nije pronađena" for everyone who is
 * not in the tester group.
 *
 * That is why the Android half of the install overlay still teaches the "add
 * to Home Screen" walkthrough while the iOS half no longer does. An Android
 * visitor has no other way to get an icon, notifications or a full screen --
 * take the walkthrough away and the web tab is all they get.
 *
 * WHEN PLAY GOES LIVE: set this to the listing URL. `hasStoreListing()` below
 * flips the overlay and the landing strip over on its own; nothing else needs
 * touching.
 */
export const PLAY_STORE_URL: string | null = null;

/** Which platforms the install overlay can send to a real store today. */
export function storeUrlFor(platform: "ios" | "android"): string | null {
  return platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
}
