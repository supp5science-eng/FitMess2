import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, resolveLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { createT } from "@/lib/i18n/translate";

describe("resolveLocale: narrows an untrusted cookie value", () => {
  it("accepts the two supported locales", () => {
    expect(resolveLocale("sr")).toBe("sr");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to the default for anything else", () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });
});

describe("createT: bound translation function", () => {
  it("returns copy in the requested locale", () => {
    expect(createT("sr")("nav.home")).toBe("Početna");
    expect(createT("en")("nav.home")).toBe("Home");
    expect(createT("en")("settings.title")).toBe("Settings");
  });

  it("interpolates {placeholder} params", () => {
    expect(createT("en")("home.mealsOn", { date: "Jul 17" })).toBe(
      "Meals · Jul 17"
    );
    expect(createT("sr")("home.mealsOn", { date: "17. jul" })).toBe(
      "Obroci · 17. jul"
    );
  });
});

describe("dictionary completeness", () => {
  it("every Serbian key has an English translation and vice versa", () => {
    const srKeys = Object.keys(messages.sr).sort();
    const enKeys = Object.keys(messages.en).sort();
    expect(enKeys).toEqual(srKeys);
  });

  it("no English value is left identical-empty", () => {
    for (const [key, value] of Object.entries(messages.en)) {
      expect(value, `en[${key}] must be non-empty`).not.toBe("");
    }
  });
});
