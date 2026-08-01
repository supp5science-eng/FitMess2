import { describe, expect, it } from "vitest";

import {
  buildExtraPrompt,
  extraEstimateSchema,
  extraQuerySchema,
  toAiExtraFood,
} from "@/lib/ai/extra-estimate";
import { applyAddMore } from "@/lib/log/add-more";
import { AI_EXTRA_ID_PREFIX, aiExtraFoodSchema } from "@/lib/log/extras";

// A written-in extra ("majonez", "2 kašike") has to end up indistinguishable
// from a catalog chip: one stepper row, one spoon per tap. These cover the
// seams where that could break -- the model's answer, the conversion, and the
// round trip back through the save path.

const answer = (over: Record<string, unknown> = {}) => ({
  prepoznato: true,
  naziv: "Majonez",
  kom_naziv: "kašika",
  kom_grami: 15,
  kom_broj: 2,
  kcal_100g: 687,
  protein_100g: 1,
  uh_100g: 1.5,
  mast_100g: 75,
  vlakna_100g: 0,
  secer_100g: 1.5,
  natrijum_100g_mg: 600,
  zasicene_100g: 11,
  napomena: "Kašika majoneza ≈ 15 g.",
  ...over,
});

describe("extraQuerySchema", () => {
  it("accepts a description with no amount — an empty box means 'a normal serving'", () => {
    const parsed = extraQuerySchema.parse({ opis: "  majonez  " });
    expect(parsed).toEqual({ opis: "majonez", kolicina: "" });
  });

  it("rejects a description too short to mean anything", () => {
    expect(extraQuerySchema.safeParse({ opis: "a" }).success).toBe(false);
  });
});

describe("buildExtraPrompt", () => {
  it("tells the model to assume a portion when the user gave no amount", () => {
    const prompt = buildExtraPrompt({ opis: "majonez", kolicina: "" });
    expect(prompt).toContain("majonez");
    expect(prompt).toContain("pretpostavi jednu uobičajenu porciju");
  });

  it("passes the amount through when there is one", () => {
    const prompt = buildExtraPrompt({ opis: "majonez", kolicina: "2 kašike" });
    expect(prompt).toContain('"2 kašike"');
  });
});

describe("extraEstimateSchema", () => {
  it("clamps a nonsense answer instead of writing it to a log", () => {
    const parsed = extraEstimateSchema.parse(
      answer({ kcal_100g: 99999, mast_100g: -3, natrijum_100g_mg: 10 ** 9 })
    );
    expect(parsed.kcal_100g).toBe(900);
    expect(parsed.mast_100g).toBe(0);
    expect(parsed.natrijum_100g_mg).toBe(40000);
  });

  it("keeps an unknown micronutrient unknown (0017: null is not zero)", () => {
    const parsed = extraEstimateSchema.parse(answer({ vlakna_100g: null }));
    expect(parsed.vlakna_100g).toBeNull();
    expect(parsed.secer_100g).toBe(1.5);
  });
});

describe("toAiExtraFood", () => {
  it("turns the answer into a catalog-shaped food plus a tap count", () => {
    const { food, units } = toAiExtraFood(
      extraEstimateSchema.parse(answer()),
      "ai:1"
    );
    expect(units).toBe(2);
    expect(food.unit_label).toBe("kašika");
    expect(food.unit_grams).toBe(15);
    expect(food.kcal_100g).toBe(687);
    // Nothing hand-written exists for a food the user just invented, so the
    // confirmation chip falls back to the plain form.
    expect(food.of).toBeNull();
  });

  it("falls back to a portion when the model gave no usable unit", () => {
    const { food } = toAiExtraFood(
      extraEstimateSchema.parse(answer({ kom_naziv: "", kom_grami: 0 })),
      "ai:2"
    );
    expect(food.unit_label).toBe("porcija");
    expect(food.unit_grams).toBe(100);
  });

  it("never adds nothing — an extra the user asked for is at least one unit", () => {
    const { units } = toAiExtraFood(
      extraEstimateSchema.parse(answer({ kom_broj: 0 })),
      "ai:3"
    );
    expect(units).toBe(1);
  });
});

describe("round trip through the save path", () => {
  const log = {
    name: "Pileći file sa hlebom",
    grams: 300,
    kcal: 500,
    protein: 50,
    carbs: 30,
    fat: 18,
    fiber: 2,
    sugar: null,
    sodium: 400,
    sat_fat: null,
    components: null,
  };

  it("grows the entry by the written-in food, from ITS own per-100 g numbers", () => {
    const { food, units } = toAiExtraFood(
      extraEstimateSchema.parse(answer()),
      `${AI_EXTRA_ID_PREFIX}abc`
    );
    // Exactly what the sheet sends and the route re-parses.
    const overWire = aiExtraFoodSchema.parse(JSON.parse(JSON.stringify(food)));

    const result = applyAddMore(
      log,
      { extras: [{ foodId: overWire.id, units }] },
      [overWire]
    );

    // 30 g of mayonnaise at 687 kcal/100 g.
    expect(result.addedKcal).toBe(206);
    expect(result.totals.grams).toBe(330);
    // Its sodium comes from the mayonnaise's own figure, not from scaling the
    // meal's by mass.
    expect(result.totals.sodium).toBe(580);
    // And fiber stays the meal's own: mayonnaise has none.
    expect(result.totals.fiber).toBe(2);
    // The entry had no breakdown, so it becomes one: itself, plus the extra.
    expect(result.components?.map((line) => line.naziv)).toEqual([
      "Pileći file sa hlebom",
      "Majonez",
    ]);
  });

  it("refuses an id that doesn't carry the ai: marker", () => {
    // The marker is what keeps catalog picks (re-read server-side) apart from
    // written-in ones (client-carried). A payload without it must not parse.
    const { food } = toAiExtraFood(extraEstimateSchema.parse(answer()), "food-1");
    expect(aiExtraFoodSchema.safeParse(food).success).toBe(false);
  });

  it("clamps a tampered payload to something a real food could be", () => {
    const { food } = toAiExtraFood(
      extraEstimateSchema.parse(answer()),
      `${AI_EXTRA_ID_PREFIX}abc`
    );
    const parsed = aiExtraFoodSchema.parse({ ...food, kcal_100g: 50000 });
    expect(parsed.kcal_100g).toBe(900);
  });
});
