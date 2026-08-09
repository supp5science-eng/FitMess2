/**
 * The three legal documents that must be readable by a stranger on a desktop
 * browser, with no account and no phone.
 *
 * This is not a preference. Each one is a hard condition of shipping:
 *
 *  - `/privatnost` — App Store Connect and Play Console both take a privacy
 *    policy URL and a reviewer opens it on a laptop. A link behind a login is
 *    an automatic rejection.
 *  - `/uslovi` — linked from the same listings, and from the app itself.
 *  - `/brisanje-naloga` — Play's account-deletion policy requires a page
 *    reachable *without installing the app*, describing how to delete the
 *    account and what gets erased. Apple is satisfied by the in-app flow
 *    (guideline 5.1.1(v)); Google is not.
 *
 * FitMess otherwise redirects every non-phone visitor to `/samo-za-telefon`
 * before anything else runs (`src/lib/device/phone-gate.ts`). That gate would
 * have answered the reviewer's click with a 307 to "open this on your phone" —
 * the same failure that once kept `robots.txt` out of Google's index. So these
 * paths are exempt there, and public in `src/lib/auth/route-protection.ts`.
 * Both exemptions are load-bearing; removing either one silently breaks a
 * store submission months after the fact.
 */

export const PRIVACY_PATH = "/privatnost";
export const TERMS_PATH = "/uslovi";
export const ACCOUNT_DELETION_PATH = "/brisanje-naloga";

export const LEGAL_PATHS: readonly string[] = [
  PRIVACY_PATH,
  TERMS_PATH,
  ACCOUNT_DELETION_PATH,
];

/**
 * Exact match, never a prefix: these are three leaf documents, and a prefix
 * match would quietly make any future `/uslovi/<something>` public too.
 */
export function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.includes(pathname);
}
