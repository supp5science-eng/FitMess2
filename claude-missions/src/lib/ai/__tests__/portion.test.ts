import { describe, expect, it } from "vitest";

import {
  defaultGeometry,
  describePortion,
  geometryHint,
  isPrepMethod,
  isVessel,
  normaliseUnit,
  portionGrams,
  type PortionUnit,
} from "@/lib/ai/portion";

const PLATE: PortionUnit = { naziv: "pun tanjir pirinča", grami: 400 };
const BOWL: PortionUnit = { naziv: "puna posuda", grami: 500 };
const PIECE: PortionUnit = { naziv: "palačinka", grami: 60 };

describe("portionGrams", () => {
  it("multiplies coverage and height against a full plate", () => {
    // Half the plate, a finger deep: half of what a fully covered plate holds.
    expect(portionGrams({ vessel: "ravan", coverage: 0.5, height: "prst" }, PLATE)).toBe(
      200
    );
    // Same spread piled twice as high weighs more, not the same.
    expect(
      portionGrams({ vessel: "ravan", coverage: 0.5, height: "dva_prsta" }, PLATE)
    ).toBeGreaterThan(300);
  });

  it("scales a bowl by how full it is", () => {
    expect(portionGrams({ vessel: "dubok", level: 0.5 }, BOWL)).toBe(250);
    expect(portionGrams({ vessel: "dubok", level: 1 }, BOWL)).toBe(500);
  });

  it("counts pieces", () => {
    expect(portionGrams({ vessel: "komadi", count: 3 }, PIECE)).toBe(180);
  });

  it("rounds to 5 g — the method has no more precision than that", () => {
    const grams = portionGrams(
      { vessel: "ravan", coverage: 0.35, height: "tanko" },
      PLATE
    );
    expect(grams % 5).toBe(0);
  });
});

describe("normaliseUnit", () => {
  it("keeps a sensible unit as given", () => {
    expect(normaliseUnit("komadi", "palačinka", 62)).toEqual({
      naziv: "palačinka",
      grami: 62,
    });
  });

  it("clamps a unit mass that would scale every drag into nonsense", () => {
    expect(normaliseUnit("komadi", "palačinka", 5000).grami).toBe(600);
    expect(normaliseUnit("ravan", "tanjir", 1).grami).toBe(120);
  });

  it("falls back when the model gives nothing", () => {
    const unit = normaliseUnit("dubok", "", "ne znam");
    expect(unit.naziv).toBe("puna posuda");
    expect(unit.grami).toBeGreaterThan(0);
  });
});

describe("defaultGeometry", () => {
  it("opens each dial in the middle of its useful range", () => {
    expect(defaultGeometry("ravan")).toEqual({
      vessel: "ravan",
      coverage: 0.7,
      height: "prst",
    });
    expect(defaultGeometry("dubok")).toEqual({ vessel: "dubok", level: 0.7 });
    expect(defaultGeometry("komadi")).toEqual({ vessel: "komadi", count: 2 });
  });
});

describe("geometryHint", () => {
  it("says what the drag means in words, per vessel", () => {
    expect(
      geometryHint({ vessel: "ravan", coverage: 1, height: "prst" }, PLATE)
    ).toContain("ceo tanjir");
    expect(geometryHint({ vessel: "dubok", level: 1 }, BOWL)).toBe("puna posuda");
    expect(geometryHint({ vessel: "komadi", count: 3 }, PIECE)).toBe(
      "3 × palačinka"
    );
  });
});

describe("describePortion", () => {
  it("is empty when the user answered nothing, so no prompt block is added", () => {
    expect(describePortion(null, null, null)).toBe("");
  });

  it("describes the SHAPE the user saw, not just a number", () => {
    const text = describePortion(
      { vessel: "ravan", coverage: 0.5, height: "dva_prsta" },
      PLATE,
      null
    );
    expect(text).toContain("50% površine tanjira");
    expect(text).toContain("dva prsta");
  });

  it("frames the mass as a range, not a measurement", () => {
    const text = describePortion({ vessel: "dubok", level: 1 }, BOWL, null);
    expect(text).toContain("500 g");
    expect(text).toContain("350–650 g");
    expect(text).toContain("ne merenje");
  });

  it("tells the model not to re-ask what was just answered", () => {
    const text = describePortion({ vessel: "komadi", count: 2 }, PIECE, "przeno");
    expect(text).toContain("NE PITAJ ponovo");
  });

  it("turns the cooking choice into grams of fat, not an adjective", () => {
    expect(describePortion(null, null, "kuvano")).toContain("bez dodate masti");
    expect(describePortion(null, null, "przeno")).toContain("15–25 g ulja");
    expect(describePortion(null, null, "malo_ulja")).toContain("8–12 g");
  });

  it("says outright that nobody cooked it when the chips were never shown", () => {
    // Silence here would be worse than a sentence: the finalize prompt asks for
    // cooking fat as its own component, so an unanswered prep slot invites a
    // spoonful of oil under a scoop of ice cream.
    const text = describePortion({ vessel: "dubok", level: 0.6 }, BOWL, null);
    expect(text).toContain("Priprema nije ni pitana");
    expect(text).toContain("NE dodaj ulje");
  });
});

describe("guards", () => {
  it("accepts known vessels and prep methods, rejects anything else", () => {
    expect(isVessel("dubok")).toBe(true);
    expect(isVessel("tanjircic")).toBe(false);
    expect(isPrepMethod("przeno")).toBe(true);
    expect(isPrepMethod("prženo")).toBe(false);
    expect(isPrepMethod(null)).toBe(false);
  });
});
