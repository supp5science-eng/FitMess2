import { describe, expect, it } from "vitest";

import { labelEstimateSchema } from "@/lib/ai/label-estimate";

describe("labelEstimateSchema", () => {
  it("parses well-formed per-100g label values", () => {
    const parsed = labelEstimateSchema.parse({
      naziv: "Plazma keks",
      brend: "Bambi",
      kcal_100g: 430,
      protein_100g: 8,
      uh_100g: 72,
      mast_100g: 12,
      sigurnost: "visoka",
      napomena: "",
    });
    expect(parsed.naziv).toBe("Plazma keks");
    expect(parsed.kcal_100g).toBe(430);
    expect(parsed.uh_100g).toBe(72);
  });

  it("clamps to the foods-form bounds (kcal <= 900, macros <= 100)", () => {
    const parsed = labelEstimateSchema.parse({
      kcal_100g: "1500",
      protein_100g: 250,
      uh_100g: "80",
      mast_100g: -3,
      sigurnost: "srednja",
    });
    expect(parsed.kcal_100g).toBe(900);
    expect(parsed.protein_100g).toBe(100);
    expect(parsed.uh_100g).toBe(80);
    expect(parsed.mast_100g).toBe(0);
  });

  it("defaults name/brand/note to empty and never throws on junk", () => {
    const parsed = labelEstimateSchema.parse({
      kcal_100g: "abc",
      protein_100g: null,
      uh_100g: undefined,
      mast_100g: 5,
      sigurnost: "?",
    });
    expect(parsed.naziv).toBe("");
    expect(parsed.brend).toBe("");
    expect(parsed.napomena).toBe("");
    expect(parsed.kcal_100g).toBe(0);
    expect(parsed.sigurnost).toBe("srednja");
  });
});
