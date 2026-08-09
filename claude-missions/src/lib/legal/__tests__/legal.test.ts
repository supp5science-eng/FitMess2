import { describe, expect, it } from "vitest";

import { decidePhoneGate } from "@/lib/device/phone-gate";
import { isPublicPath } from "@/lib/auth/route-protection";
import { CONTROLLER, LEGAL_EFFECTIVE_DATE, MINIMUM_AGE } from "@/lib/legal/controller";
import {
  ACCOUNT_DELETION_PATH,
  LEGAL_PATHS,
  PRIVACY_PATH,
  TERMS_PATH,
  isLegalPath,
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
  it("names exactly the three documents the stores require", () => {
    expect(LEGAL_PATHS).toEqual([
      PRIVACY_PATH,
      TERMS_PATH,
      ACCOUNT_DELETION_PATH,
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
