import { describe, expect, it } from "vitest";

import {
  applyAddMore,
  componentUnitFraction,
  componentUnitLabel,
  readComponents,
  type AddMoreLogInput,
} from "@/lib/log/add-more";
import type { ExtraFood } from "@/lib/log/extras";
import type { LogComponentSnapshot } from "@/lib/types/db";

// "Dodaj još": seconds without a second photo. These lock the two shapes the
// feature exists for -- "one more wafer" (whole entry) and "two more eggs and a
// spoon of sour cream" (single parts of a photographed plate).

const wafer: AddMoreLogInput = {
  grams: 25,
  kcal: 130,
  protein: 1.5,
  carbs: 16,
  fat: 7,
  fiber: 0.5,
  sugar: 10,
  sodium: 40,
  sat_fat: 4,
};

const eggs: LogComponentSnapshot = {
  naziv: "Jaja",
  grami: 120,
  kcal: 180,
  protein_g: 12.6,
  uh_g: 1.2,
  mast_g: 12,
  kom_naziv: "jaje",
  kom_grami: 60,
};

const tuna: LogComponentSnapshot = {
  naziv: "Tuna",
  grami: 80,
  kcal: 92,
  protein_g: 20,
  uh_g: 0,
  mast_g: 1,
  kom_naziv: "konzerva",
  kom_grami: 80,
};

const cream: LogComponentSnapshot = {
  naziv: "Pavlaka",
  grami: 30,
  kcal: 60,
  protein_g: 0.9,
  uh_g: 1.2,
  mast_g: 6,
  kom_naziv: "kašika",
  kom_grami: 15,
};

const plate: AddMoreLogInput = {
  grams: 230,
  kcal: 332,
  protein: 33.5,
  carbs: 2.4,
  fat: 19,
  fiber: null,
  sugar: 2,
  sodium: 600,
  sat_fat: 8,
  components: [eggs, tuna, cream],
};

describe("applyAddMore — whole entry", () => {
  it("doubles an entry that has no breakdown", () => {
    const result = applyAddMore(wafer, { whole: 1, components: [] });

    expect(result.totals.kcal).toBe(260);
    expect(result.totals.grams).toBe(50);
    expect(result.totals.protein).toBe(3);
    expect(result.addedKcal).toBe(130);
    expect(result.components).toBeNull();
    expect(result.isEmpty).toBe(false);
  });

  it("scales micronutrients with the entry, keeping unknown unknown", () => {
    const result = applyAddMore(
      { ...wafer, fiber: null },
      { whole: 2, components: [] }
    );

    expect(result.totals.kcal).toBe(390);
    expect(result.totals.sodium).toBe(120);
    // Unknown at one portion is still unknown at three -- never 0 (0017).
    expect(result.totals.fiber).toBeNull();
  });

  it("treats a selection of nothing as empty", () => {
    const result = applyAddMore(wafer, { whole: 0, components: [] });

    expect(result.isEmpty).toBe(true);
    expect(result.addedKcal).toBe(0);
    expect(result.totals.kcal).toBe(130);
  });
});

describe("applyAddMore — single components", () => {
  it("adds two more eggs and one more spoon of cream, nothing else", () => {
    const result = applyAddMore(plate, {
      whole: 0,
      components: [
        { index: 0, units: 2 },
        { index: 2, units: 1 },
      ],
    });

    // 2 eggs = 2 x 60 g of a 120 g line = the whole line again = 180 kcal;
    // 1 spoon = 15 g of a 30 g line = half of it = 30 kcal.
    expect(result.addedKcal).toBe(210);
    expect(result.totals.grams).toBe(365);
    expect(result.totals.kcal).toBe(542);

    // The breakdown grows unevenly and the tuna line is untouched.
    expect(result.components?.[0].grami).toBe(240);
    expect(result.components?.[1].grami).toBe(80);
    expect(result.components?.[2].grami).toBe(45);
  });

  it("keeps each line's natural unit intact so the next '+1' adds the same amount", () => {
    const once = applyAddMore(plate, {
      whole: 0,
      components: [{ index: 0, units: 1 }],
    });
    const twice = applyAddMore(
      { ...plate, components: once.components },
      { whole: 0, components: [{ index: 0, units: 1 }] }
    );

    expect(once.components?.[0].kom_grami).toBe(60);
    expect(once.addedKcal).toBe(90);
    // Second visit adds exactly one more egg, not "half of the bigger line".
    expect(twice.addedKcal).toBe(90);
    expect(twice.components?.[0].grami).toBe(240);
  });

  it("steps a line with no natural unit by the whole line", () => {
    const sauce: LogComponentSnapshot = {
      naziv: "Sos",
      grami: 40,
      kcal: 90,
      protein_g: 0.5,
      uh_g: 3,
      mast_g: 8,
      kom_naziv: "",
      kom_grami: 0,
    };

    const result = applyAddMore(
      { ...plate, components: [sauce] },
      { whole: 0, components: [{ index: 0, units: 1 }] }
    );

    expect(result.addedKcal).toBe(90);
    expect(result.components?.[0].grami).toBe(80);
  });

  it("grows every line when the whole entry is repeated", () => {
    const result = applyAddMore(plate, { whole: 1, components: [] });

    expect(result.components?.map((c) => c.grami)).toEqual([240, 160, 60]);
    expect(result.totals.kcal).toBe(664);
  });

  it("ignores picks pointing past the stored breakdown", () => {
    const result = applyAddMore(plate, {
      whole: 0,
      components: [{ index: 9, units: 3 }],
    });

    expect(result.isEmpty).toBe(true);
    expect(result.totals.kcal).toBe(332);
  });
});

describe("readComponents", () => {
  it("returns an empty list for a missing or malformed breakdown", () => {
    expect(readComponents(null)).toEqual([]);
    expect(readComponents(undefined)).toEqual([]);
    expect(
      readComponents([{ naziv: "x" } as unknown as LogComponentSnapshot])
    ).toEqual([]);
  });

  it("keeps well-formed lines", () => {
    expect(readComponents([eggs, tuna])).toHaveLength(2);
  });
});

describe("component unit helpers", () => {
  it("derives the per-step share from the natural unit", () => {
    expect(componentUnitFraction(eggs)).toBe(0.5);
    expect(componentUnitFraction(cream)).toBe(0.5);
    expect(componentUnitFraction({ ...eggs, kom_grami: 0 })).toBe(1);
    // A unit heavier than the line itself never adds more than one line.
    expect(componentUnitFraction({ ...cream, kom_grami: 90 })).toBe(1);
  });

  it("labels one step in the user's words", () => {
    expect(componentUnitLabel(eggs)).toBe("1 jaje · 60 g");
    expect(componentUnitLabel({ ...eggs, kom_naziv: "", kom_grami: 0 })).toBe(
      "cela stavka · 120 g"
    );
  });
});

// "Nije bilo na slici" (2026-08-01): the entry grows by a food that was never
// part of it. Mayonnaise is the case the feature was built for -- 687 kcal/100 g
// that nobody photographs, and that no stepper above could express.
const mayo: ExtraFood = {
  id: "food-mayo",
  name_sr: "Majonez",
  kcal_100g: 687,
  protein_100g: 1.1,
  carbs_100g: 1.6,
  fat_100g: 75,
  fiber_100g: 0,
  sugar_100g: 1.6,
  sodium_100g: 600,
  sat_fat_100g: 11,
  unit_label: "kašika",
  unit_grams: 15,
  emoji: "🥄",
  label: "Majonez",
  of: "majoneza",
};

describe("applyAddMore — extras that were never in the photo", () => {
  it("adds a spoon of mayonnaise to a photographed plate", () => {
    const result = applyAddMore(
      plate,
      { extras: [{ foodId: "food-mayo", units: 1 }] },
      [mayo]
    );

    // 15 g at 687 kcal/100 g.
    expect(result.addedKcal).toBe(103);
    expect(result.totals.grams).toBe(245);
    expect(result.totals.kcal).toBe(435);
    expect(result.isEmpty).toBe(false);
  });

  it("appends the extra to the breakdown so it can be stepped next time", () => {
    const result = applyAddMore(
      plate,
      { extras: [{ foodId: "food-mayo", units: 2 }] },
      [mayo]
    );

    expect(result.components).toHaveLength(4);
    expect(result.components?.[3]).toMatchObject({
      naziv: "Majonez",
      grami: 30,
      // The natural unit survives, so the NEXT "+1" adds one spoon, not two.
      kom_naziv: "kašika",
      kom_grami: 15,
    });
  });

  it("grows the existing line instead of stacking a duplicate on a second visit", () => {
    const once = applyAddMore(
      plate,
      { extras: [{ foodId: "food-mayo", units: 1 }] },
      [mayo]
    );
    const twice = applyAddMore(
      { ...plate, components: once.components, grams: once.totals.grams, kcal: once.totals.kcal },
      { extras: [{ foodId: "food-mayo", units: 1 }] },
      [mayo]
    );

    const mayoLines = twice.components?.filter((line) => line.naziv === "Majonez");
    expect(mayoLines).toHaveLength(1);
    expect(mayoLines?.[0].grami).toBe(30);
  });

  it("turns an entry with no breakdown into one, rather than claiming it IS the extra", () => {
    const result = applyAddMore(
      { ...wafer, name: "Napolitanka" },
      { extras: [{ foodId: "food-mayo", units: 1 }] },
      [mayo]
    );

    // The entry's own totals become the first line; the extra sits beside it,
    // so the breakdown still adds up to the row.
    expect(result.components).toHaveLength(2);
    expect(result.components?.[0]).toMatchObject({
      naziv: "Napolitanka",
      grami: 25,
      kcal: 130,
    });
    expect(result.components?.[1]?.naziv).toBe("Majonez");
  });

  it("counts the extra's own micronutrients, not the meal's scaled by its mass", () => {
    const result = applyAddMore(
      { ...plate, sugar: 2, sodium: 600 },
      { extras: [{ foodId: "food-mayo", units: 1 }] },
      [mayo]
    );

    // Sugar: 2 g (unchanged, no same-food additions) + 1.6 g/100 g × 15 g.
    expect(result.totals.sugar).toBeCloseTo(2.2, 1);
    expect(result.totals.sodium).toBeCloseTo(690, 0);
    // Fiber was unknown on the plate and stays unknown -- adding mayonnaise
    // does not turn "we never knew" into a confident number (0017).
    expect(result.totals.fiber).toBeNull();
  });

  it("ignores a pick whose food no longer resolves", () => {
    const result = applyAddMore(
      plate,
      { extras: [{ foodId: "food-gone", units: 3 }] },
      [mayo]
    );

    expect(result.isEmpty).toBe(true);
    expect(result.addedKcal).toBe(0);
    // Nothing was added, so the breakdown is left exactly as it was.
    expect(result.components).toHaveLength(3);
  });

  it("adds seconds and an extra in the same save", () => {
    const result = applyAddMore(
      plate,
      {
        components: [{ index: 0, units: 2 }],
        extras: [{ foodId: "food-mayo", units: 1 }],
      },
      [mayo]
    );

    // Two more eggs (180 kcal) plus a spoon of mayonnaise (103 kcal).
    expect(result.addedKcal).toBe(283);
    expect(result.components?.[0].grami).toBe(240);
    expect(result.components?.[3]?.naziv).toBe("Majonez");
  });
});
