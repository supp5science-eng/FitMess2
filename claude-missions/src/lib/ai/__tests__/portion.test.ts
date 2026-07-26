import { describe, expect, it } from "vitest";

import {
  describeUserPortion,
  isPrepMethod,
  portionHint,
  PORTION_DEFAULT_G,
} from "@/lib/ai/portion";

describe("portionHint", () => {
  it("describes the dial's whole range without gaps", () => {
    for (let g = 50; g <= 900; g += 10) {
      expect(portionHint(g).length).toBeGreaterThan(0);
    }
  });

  it("calls the default a full plate", () => {
    expect(portionHint(PORTION_DEFAULT_G)).toContain("pun tanjir");
  });
});

describe("describeUserPortion", () => {
  it("is empty when the user answered nothing, so no prompt block is added", () => {
    expect(describeUserPortion(null, null)).toBe("");
  });

  it("frames the mass as a range, not a measurement", () => {
    const text = describeUserPortion(400, null);
    // The band is what stops the model from treating a human guess as fact.
    expect(text).toContain("260–540 g");
    expect(text).toContain("gruba");
  });

  it("tells the model not to re-ask what was just answered", () => {
    const text = describeUserPortion(300, "przeno");
    expect(text).toContain("NE PITAJ ponovo");
  });

  it("turns the cooking choice into grams of fat, not an adjective", () => {
    expect(describeUserPortion(null, "kuvano")).toContain("bez dodate masti");
    expect(describeUserPortion(null, "przeno")).toContain("15–25 g ulja");
  });

  it("works with only one of the two answers", () => {
    expect(describeUserPortion(null, "malo_ulja")).toContain("8–12 g");
    expect(describeUserPortion(250, null)).not.toContain("Priprema");
  });
});

describe("isPrepMethod", () => {
  it("accepts the known methods and rejects anything else", () => {
    expect(isPrepMethod("przeno")).toBe(true);
    expect(isPrepMethod("prženo")).toBe(false);
    expect(isPrepMethod(null)).toBe(false);
    expect(isPrepMethod(42)).toBe(false);
  });
});
