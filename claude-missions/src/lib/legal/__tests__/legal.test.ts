import { describe, expect, it } from "vitest";

import { decidePhoneGate } from "@/lib/device/phone-gate";
import { isPublicPath } from "@/lib/auth/route-protection";
import { CONTROLLER, LEGAL_EFFECTIVE_DATE, MINIMUM_AGE } from "@/lib/legal/controller";
import {
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_PATH_EN,
  LEGAL_ALIASES,
  LEGAL_ALIAS_PATHS,
  LEGAL_PATHS,
  LEGAL_PATHS_EN,
  PRIVACY_PATH,
  PRIVACY_PATH_EN,
  PUBLIC_LEGAL_PATHS,
  SOURCES_PATH,
  SOURCES_PATH_EN,
  TERMS_PATH,
  TERMS_PATH_EN,
  isLegalPath,
  legalAliasTarget,
  legalAlternates,
} from "@/lib/legal/paths";
import { messages } from "@/lib/i18n/messages";

/**
 * The legal documents exist to be opened by a stranger, on a desktop, with no
 * account — a store reviewer clicking the privacy-policy link on the listing.
 * Every assertion here guards one way that has silently stopped working
 * before: a gate added upstream, a route made private, an address reduced to a
 * fragment. Each failure would only surface as a store rejection weeks later.
 */

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("legal document paths", () => {
  it("names exactly the four documents the stores require", () => {
    // The fourth is `/izvori` — the citations behind the app's health
    // calculations, which App Review requires under guideline 1.4.1 and
    // requires to be easy to find. It is public in the same strong sense as
    // the other three: a reviewer opens it on a desktop with no account.
    expect(LEGAL_PATHS).toEqual([
      PRIVACY_PATH,
      TERMS_PATH,
      ACCOUNT_DELETION_PATH,
      SOURCES_PATH,
    ]);
  });

  it("matches exactly, never by prefix", () => {
    expect(isLegalPath(PRIVACY_PATH)).toBe(true);
    // A future `/uslovi/nesto` must not inherit public access by accident.
    expect(isLegalPath(`${TERMS_PATH}/dodatak`)).toBe(false);
    expect(isLegalPath("/privatnostx")).toBe(false);
    expect(isLegalPath("/danas")).toBe(false);
  });
});

describe("a desktop reviewer with no account", () => {
  it.each(LEGAL_PATHS)("reaches %s past the phone-only gate", (path) => {
    expect(decidePhoneGate({ pathname: path, userAgent: DESKTOP_UA })).toEqual({
      action: "allow",
    });
  });

  it("is still redirected away from the app itself", () => {
    // The exemption is for the documents only -- the phone gate must keep
    // doing its job everywhere else.
    expect(decidePhoneGate({ pathname: "/danas", userAgent: DESKTOP_UA })).toEqual({
      action: "redirect",
      to: "/samo-za-telefon",
    });
  });

  it.each(LEGAL_PATHS)("is not sent to the login screen from %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });
});

/**
 * The English URLs exist for a reader who arrives with no cookie — a store
 * reviewer. Every gate that guards the Serbian originals has to let these
 * through too, and an alias has to survive the gates BEFORE it can redirect:
 * the phone gate runs ahead of the route, so an alias missing from the public
 * list is answered with "open this on your phone" and never reaches its own
 * `permanentRedirect`.
 */
describe("the English URLs", () => {
  it.each([...LEGAL_PATHS_EN, ...LEGAL_ALIAS_PATHS])(
    "%s is public and past the phone-only gate",
    (path) => {
      expect(isLegalPath(path)).toBe(true);
      expect(isPublicPath(path)).toBe(true);
      expect(decidePhoneGate({ pathname: path, userAgent: DESKTOP_UA })).toEqual({
        action: "allow",
      });
    }
  );

  it("pairs each document with its own translation", () => {
    expect(LEGAL_PATHS_EN).toEqual([
      PRIVACY_PATH_EN,
      TERMS_PATH_EN,
      ACCOUNT_DELETION_PATH_EN,
      SOURCES_PATH_EN,
    ]);
    // Same order as LEGAL_PATHS, so the two lists line up document by
    // document — that pairing is what `legalAlternates` and the sitemap rely on.
    expect(LEGAL_PATHS_EN).toHaveLength(LEGAL_PATHS.length);
  });

  it("redirects every alias to a canonical document, never to another alias", () => {
    for (const alias of LEGAL_ALIAS_PATHS) {
      const target = legalAliasTarget(alias);
      expect(target, `${alias} has no target`).not.toBeNull();
      expect(LEGAL_PATHS).toContain(target);
    }
    expect(LEGAL_ALIASES["/privacy"]).toBe(PRIVACY_PATH);
    expect(LEGAL_ALIASES["/terms"]).toBe(TERMS_PATH);
    expect(LEGAL_ALIASES["/delete-account"]).toBe(ACCOUNT_DELETION_PATH);
    expect(LEGAL_ALIASES["/sources"]).toBe(SOURCES_PATH);
  });

  it("is not an alias for anything else", () => {
    expect(legalAliasTarget("/danas")).toBeNull();
    expect(legalAliasTarget(PRIVACY_PATH)).toBeNull();
  });

  it("keeps the Serbian URL canonical for both languages", () => {
    // One document, one indexable address. If the English page ever declared
    // itself canonical, the same policy would compete with itself in the index
    // and a store listing could end up pointing at the losing URL.
    const alternates = legalAlternates(PRIVACY_PATH, PRIVACY_PATH_EN);
    expect(alternates.canonical).toBe(PRIVACY_PATH);
    expect(alternates.languages.en).toBe(PRIVACY_PATH_EN);
    expect(alternates.languages["sr-Latn-RS"]).toBe(PRIVACY_PATH);
  });

  it("still matches exactly, never by prefix", () => {
    expect(isLegalPath("/en")).toBe(false);
    expect(isLegalPath(`${PRIVACY_PATH_EN}/nesto`)).toBe(false);
    expect(isLegalPath("/privacyx")).toBe(false);
  });

  it("lists every public URL exactly once", () => {
    expect(new Set(PUBLIC_LEGAL_PATHS).size).toBe(PUBLIC_LEGAL_PATHS.length);
  });
});

describe("controller details", () => {
  it("names a person, not a brand", () => {
    // GDPR art. 13(1)(a): "FitMess" identifies nobody. A controller has to be
    // someone a reader can point at.
    expect(CONTROLLER.name).toMatch(/\S+\s+\S+/);
    expect(CONTROLLER.name).not.toMatch(/fitmess/i);
  });

  it("gives a contact address that is a real mailbox", () => {
    expect(CONTROLLER.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    // `podrska@fitmess.app` only ever existed as a Resend *sending* identity;
    // nothing was delivered to it. Naming it in a privacy policy would publish
    // an address that silently drops data-subject requests.
    expect(CONTROLLER.email).not.toBe("podrska@fitmess.app");
  });

  it("dates the documents as a plain calendar day", () => {
    expect(LEGAL_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sets a minimum age consistent with the consent rules", () => {
    expect(MINIMUM_AGE).toBeGreaterThanOrEqual(16);
  });
});

describe("document copy", () => {
  const LEGAL_KEYS = Object.keys(messages.sr).filter((key) =>
    key.startsWith("legal.")
  );

  it("exists in both languages", () => {
    expect(LEGAL_KEYS.length).toBeGreaterThan(0);
    for (const key of LEGAL_KEYS) {
      const en = messages.en[key as keyof typeof messages.en];
      expect(en, `English copy missing for ${key}`).toBeTruthy();
    }
  });

  it("leaves no unfilled placeholder in either language", () => {
    // Every `{...}` in this copy is interpolated from `controller.ts`; a typo
    // in a placeholder name renders the literal braces to the reader.
    const allowed = new Set(["name", "email", "date", "age", "phrase"]);
    for (const key of LEGAL_KEYS) {
      for (const locale of ["sr", "en"] as const) {
        const text = messages[locale][key as keyof typeof messages.sr];
        for (const [, token] of text.matchAll(/\{(\w+)\}/g)) {
          expect(allowed.has(token), `${key} (${locale}) uses {${token}}`).toBe(
            true
          );
        }
      }
    }
  });
});
