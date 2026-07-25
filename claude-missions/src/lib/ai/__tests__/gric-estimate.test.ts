import { describe, expect, it } from "vitest";

import {
  MEAL_SIZED_KCAL,
  gricEstimateSchema,
  needsConfirmation,
  scaleGricItem,
  totalKcal,
  type GricItem,
} from "@/lib/ai/gric-estimate";

const item = (overrides: Partial<GricItem> = {}): GricItem => ({
  naziv: "Krastavac",
  kolicina: "1 komad",
  grami: 150,
  kcal: 24,
  protein_g: 1,
  uh_g: 5.4,
  mast_g: 0.2,
  varijansa: "niska",
  ...overrides,
});

describe("gricEstimateSchema", () => {
  it("keeps several spoken snacks as separate items", () => {
    const parsed = gricEstimateSchema.parse({
      stavke: [
        { naziv: "Krastavac", kolicina: "1 komad", grami: 150, kcal: 24, protein_g: 1, uh_g: 5.4, mast_g: 0.2, varijansa: "niska" },
        { naziv: "Suncokretove semenke", kolicina: "šaka", grami: 25, kcal: 145, protein_g: 5, uh_g: 5, mast_g: 12.6, varijansa: "srednja" },
        { naziv: "Kajsije", kolicina: "2 komada", grami: 80, kcal: 38, protein_g: 1.1, uh_g: 8.8, mast_g: 0.3, varijansa: "niska" },
      ],
    });

    expect(parsed.stavke).toHaveLength(3);
    expect(parsed.stavke.map((s) => s.naziv)).toEqual([
      "Krastavac",
      "Suncokretove semenke",
      "Kajsije",
    ]);
  });

  it("falls back to an empty list when nothing edible was understood", () => {
    expect(gricEstimateSchema.parse({ stavke: [] }).stavke).toEqual([]);
    expect(gricEstimateSchema.parse({}).stavke).toEqual([]);
  });

  it("clamps nonsense values instead of throwing", () => {
    const parsed = gricEstimateSchema.parse({
      stavke: [
        {
          naziv: "Kolač",
          kolicina: "parče",
          grami: -5,
          kcal: "350",
          protein_g: 4,
          uh_g: 48,
          mast_g: 16,
          varijansa: "ogromna",
        },
      ],
    });

    // A bad weight becomes the 1 g floor, a numeric string coerces, and an
    // unknown variance degrades to the middle rather than breaking the flow.
    expect(parsed.stavke[0].grami).toBe(1);
    expect(parsed.stavke[0].kcal).toBe(350);
    expect(parsed.stavke[0].varijansa).toBe("srednja");
  });
});

describe("scaleGricItem", () => {
  it("leaves the model's own estimate untouched at 'normalno'", () => {
    const base = item();
    expect(scaleGricItem(base, "normalno")).toBe(base);
  });

  it("rescales weight and every macro together", () => {
    const scaled = scaleGricItem(
      item({ naziv: "Kolač", grami: 90, kcal: 350, protein_g: 4, uh_g: 48, mast_g: 16 }),
      "veliko"
    );

    expect(scaled.grami).toBe(144);
    expect(scaled.kcal).toBe(560);
    expect(scaled.uh_g).toBe(76.8);
  });

  it("never compounds: scaling always starts from the original item", () => {
    const base = item({ grami: 100, kcal: 200 });
    const down = scaleGricItem(base, "malo");
    const backUp = scaleGricItem(base, "normalno");

    expect(down.kcal).toBe(120);
    // Re-scaling the ORIGINAL returns the original numbers, so tapping
    // Manje -> Normalno -> Manje can't drift.
    expect(backUp.kcal).toBe(200);
    expect(scaleGricItem(base, "malo").kcal).toBe(down.kcal);
  });
});

describe("needsConfirmation", () => {
  it("stays silent for snacks whose portion barely varies", () => {
    expect(
      needsConfirmation([item(), item({ naziv: "Kajsije", varijansa: "srednja" })])
    ).toBe(false);
  });

  it("asks as soon as one item's portion genuinely varies", () => {
    expect(
      needsConfirmation([item(), item({ naziv: "Kolač", varijansa: "visoka" })])
    ).toBe(true);
  });
});

describe("totalKcal", () => {
  it("sums the items and rounds once", () => {
    expect(totalKcal([item({ kcal: 24 }), item({ kcal: 145 }), item({ kcal: 38 })])).toBe(207);
  });

  it("recognises a 'gric' that was really a meal", () => {
    const total = totalKcal([item({ naziv: "Kolač", kcal: 350 }), item({ kcal: 145 })]);
    expect(total).toBeGreaterThanOrEqual(MEAL_SIZED_KCAL);
  });
});
