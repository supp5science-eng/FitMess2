/**
 * The three legal documents that must be readable by a stranger on a desktop
 * browser, with no account and no phone — and the extra URLs those same three
 * documents also answer on.
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
 *
 * ## Why there are three sets of URLs, not one
 *
 * The Serbian paths below are the CANONICAL ones — the URLs that go in the
 * sitemap, in `alternates.canonical`, and in both store consoles.
 *
 * The `/en/*` paths render the same documents with the language pinned to
 * English by the URL itself, not by the `fm_locale` cookie. A reviewer in
 * Mountain View or Cupertino has no cookie, so cookie-resolved English is
 * unreachable for exactly the reader who most needs it — and "our policy is in
 * English if you first find the language switch inside an app you have not
 * installed" is not an answer.
 *
 * The English-word aliases (`/privacy`, `/terms`, `/delete-account`) exist
 * because they are what people type and what gets pasted into a form from
 * memory. They are permanent redirects to the canonical Serbian paths rather
 * than copies, so there is exactly one indexable URL per document.
 */

/** Canonical (Serbian) document URLs. These are what the stores point at. */
export const PRIVACY_PATH = "/privatnost";
export const TERMS_PATH = "/uslovi";
export const ACCOUNT_DELETION_PATH = "/brisanje-naloga";

/** The same three documents, rendered in English regardless of any cookie. */
export const PRIVACY_PATH_EN = "/en/privacy";
export const TERMS_PATH_EN = "/en/terms";
export const ACCOUNT_DELETION_PATH_EN = "/en/delete-account";

export const LEGAL_PATHS: readonly string[] = [
  PRIVACY_PATH,
  TERMS_PATH,
  ACCOUNT_DELETION_PATH,
];

export const LEGAL_PATHS_EN: readonly string[] = [
  PRIVACY_PATH_EN,
  TERMS_PATH_EN,
  ACCOUNT_DELETION_PATH_EN,
];

/**
 * Convenience aliases → the canonical path each one permanently redirects to.
 * Keys are matched exactly; the route files live at `src/app/<alias>/page.tsx`
 * and do nothing but `permanentRedirect` here.
 */
export const LEGAL_ALIASES: Readonly<Record<string, string>> = {
  "/privacy": PRIVACY_PATH,
  "/terms": TERMS_PATH,
  "/delete-account": ACCOUNT_DELETION_PATH,
};

export const LEGAL_ALIAS_PATHS: readonly string[] = Object.keys(LEGAL_ALIASES);

/**
 * Every URL that must survive both gates. An alias belongs here even though it
 * only ever redirects: the phone gate runs BEFORE the route does, so an alias
 * left out of this list is answered with "open this on your phone" and never
 * reaches its own redirect.
 */
export const PUBLIC_LEGAL_PATHS: readonly string[] = [
  ...LEGAL_PATHS,
  ...LEGAL_PATHS_EN,
  ...LEGAL_ALIAS_PATHS,
];

/**
 * Exact match, never a prefix: these are leaf documents, and a prefix match
 * would quietly make any future `/uslovi/<something>` public too.
 */
export function isLegalPath(pathname: string): boolean {
  return PUBLIC_LEGAL_PATHS.includes(pathname);
}

/** The canonical path an alias redirects to, or `null` if it isn't an alias. */
export function legalAliasTarget(pathname: string): string | null {
  return LEGAL_ALIASES[pathname] ?? null;
}

/**
 * The Serbian ↔ English URL pair for one document, in the shape Next's
 * `alternates` metadata wants. Both pages declare the SAME canonical (the
 * Serbian path) and the same `languages` map, so search engines index one URL
 * per document and still know an English rendering exists.
 */
export function legalAlternates(canonical: string, english: string) {
  return {
    canonical,
    languages: {
      "sr-Latn-RS": canonical,
      en: english,
    },
  };
}
