import { describe, expect, it } from "vitest";

import { formatUnitCount, serbianNumberForm } from "@/lib/log/units-sr";

// The sheet is read mid-snack, once per snack. "2 jaje" is the kind of thing
// that quietly tells a user the app was assembled rather than written.

describe("serbianNumberForm", () => {
  it("follows Serbian numeral agreement, including the teens exception", () => {
    expect(serbianNumberForm(1)).toBe("one");
    expect(serbianNumberForm(21)).toBe("one");
    expect(serbianNumberForm(2)).toBe("few");
    expect(serbianNumberForm(4)).toBe("few");
    expect(serbianNumberForm(22)).toBe("few");
    expect(serbianNumberForm(5)).toBe("many");
    expect(serbianNumberForm(0)).toBe("many");
    // 11-14 take the plural despite ending in 1-4.
    expect(serbianNumberForm(11)).toBe("many");
    expect(serbianNumberForm(12)).toBe("many");
    expect(serbianNumberForm(14)).toBe("many");
  });
});

describe("formatUnitCount", () => {
  it("declines the units the meal split actually produces", () => {
    expect(formatUnitCount(1, "jaje")).toBe("1 jaje");
    expect(formatUnitCount(2, "jaje")).toBe("2 jajeta");
    expect(formatUnitCount(6, "jaje")).toBe("6 jaja");
    expect(formatUnitCount(1, "kašika")).toBe("1 kašika");
    expect(formatUnitCount(3, "kašika")).toBe("3 kašike");
    expect(formatUnitCount(5, "kašika")).toBe("5 kašika");
    expect(formatUnitCount(2, "kriška")).toBe("2 kriške");
    expect(formatUnitCount(1, "komad")).toBe("1 komad");
    expect(formatUnitCount(2, "komad")).toBe("2 komada");
  });

  it("matches a unit written without diacritics", () => {
    expect(formatUnitCount(3, "kasika")).toBe("3 kašike");
  });

  it("falls back to the unambiguous × form for an unknown unit", () => {
    expect(formatUnitCount(3, "šnita")).toBe("3 × šnita");
  });

  it("returns a bare number when there is no unit", () => {
    expect(formatUnitCount(2, "")).toBe("2");
    expect(formatUnitCount(2, undefined)).toBe("2");
  });
});
