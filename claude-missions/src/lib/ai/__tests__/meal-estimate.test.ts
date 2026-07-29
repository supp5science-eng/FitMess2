import { describe, expect, it } from "vitest";

import { mealEstimateSchema } from "@/lib/ai/meal-estimate";

describe("mealEstimateSchema", () => {
  it("parses a well-formed estimate", () => {
    const parsed = mealEstimateSchema.parse({
      naziv: "Ćevapi sa lepinjom",
      sastojci: ["ćevapi", "lepinja", "luk"],
      procenjeni_grami: 350,
      kcal: 820,
      protein_g: 45,
      uh_g: 60,
      mast_g: 40,
      sigurnost: "srednja",
      napomena: "pretpostavljeno 10 ćevapa",
    });
    expect(parsed.naziv).toBe("Ćevapi sa lepinjom");
    expect(parsed.procenjeni_grami).toBe(350);
    expect(parsed.kcal).toBe(820);
    expect(parsed.sigurnost).toBe("srednja");
  });

  it("coerces numeric strings and clamps out-of-range values", () => {
    const parsed = mealEstimateSchema.parse({
      naziv: "Test",
      procenjeni_grami: "99999", // clamped to 4000
      kcal: "-50", // clamped to 0
      protein_g: "12.5",
      uh_g: 999999, // clamped to 800
      mast_g: 10,
      sigurnost: "visoka",
    });
    expect(parsed.procenjeni_grami).toBe(4000);
    expect(parsed.kcal).toBe(0);
    expect(parsed.protein_g).toBe(12.5);
    expect(parsed.uh_g).toBe(800);
  });

  it("falls back on missing/garbage fields instead of throwing", () => {
    const parsed = mealEstimateSchema.parse({
      naziv: "",
      procenjeni_grami: "not a number",
      kcal: "abc",
      protein_g: null,
      uh_g: undefined,
      mast_g: 5,
      sigurnost: "nepoznato",
    });
    expect(parsed.naziv).toBe("Obrok sa slike");
    expect(parsed.procenjeni_grami).toBe(1); // min floor after coercion fallback
    expect(parsed.kcal).toBe(0);
    expect(parsed.protein_g).toBe(0);
    expect(parsed.uh_g).toBe(0);
    expect(parsed.sigurnost).toBe("srednja"); // enum fallback
    expect(parsed.sastojci).toEqual([]);
    expect(parsed.napomena).toBe("");
  });

  it("parses the no-food flag, defaulting to false when absent or garbage", () => {
    const base = {
      naziv: "Test",
      procenjeni_grami: 100,
      kcal: 100,
      protein_g: 5,
      uh_g: 5,
      mast_g: 5,
      sigurnost: "srednja",
    };
    expect(mealEstimateSchema.parse({ ...base, nema_hrane: true }).nema_hrane).toBe(true);
    expect(mealEstimateSchema.parse(base).nema_hrane).toBe(false);
    expect(
      mealEstimateSchema.parse({ ...base, nema_hrane: "nonsense" }).nema_hrane
    ).toBe(false);
  });
});
