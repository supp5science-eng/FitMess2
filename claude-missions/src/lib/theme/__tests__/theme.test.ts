import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, resolveTheme } from "../theme";

describe("resolveTheme: narrows an untrusted cookie value to a Theme", () => {
  it("accepts the two valid values", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("falls back to the default (dark) for anything else", () => {
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveTheme("")).toBe(DEFAULT_THEME);
    expect(resolveTheme("LIGHT")).toBe(DEFAULT_THEME);
    expect(resolveTheme("system")).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });
});
