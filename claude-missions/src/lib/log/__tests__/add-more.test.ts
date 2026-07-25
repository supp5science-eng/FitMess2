import { describe, expect, it } from "vitest";

import {
  applyAddMore,
  componentUnitFraction,
  componentUnitLabel,
  readComponents,
  type AddMoreLogInput,
} from "@/lib/log/add-more";
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
