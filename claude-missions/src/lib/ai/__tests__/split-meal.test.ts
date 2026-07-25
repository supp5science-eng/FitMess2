import { describe, expect, it } from "vitest";

import { normalizeSplit } from "@/lib/ai/split-meal";

// Splitting an ALREADY LOGGED meal must never change what the day counts --
// the user reviewed and accepted those kcal. The model supplies the ratio
// between the foods and the size of one natural unit; the totals are ours.

const meal = {
  name: "Kajgana od 6 jaja sa kiselom pavlakom",
  grams: 360,
  kcal: 625,
  protein: 42,
  carbs: 6,
  fat: 47,
};

const part = (over: Partial<Parameters<typeof normalizeSplit>[0][number]>) => ({
  naziv: "Jaja",
  kom_naziv: "jaje",
  kom_grami: 50,
  kom_broj: 6,
  grami: 300,
  kcal: 450,
  protein_g: 36,
  uh_g: 3,
  mast_g: 33,
  ...over,
});

describe("normalizeSplit", () => {
  it("keeps the stored totals exactly when the model's sums drift", () => {
    // Model's parts add up to 700 kcal against a stored 625.
    const parts = normalizeSplit(
      [
        part({ kcal: 500, grami: 320 }),
        part({
          naziv: "Kisela pavlaka",
          kom_naziv: "kašika",
          kom_grami: 20,
          kom_broj: 3,
          grami: 60,
          kcal: 200,
          protein_g: 2,
          uh_g: 2,
          mast_g: 12,
        }),
      ],
      meal
    );

    const sum = (pick: (p: (typeof parts)[number]) => number) =>
      Math.round(parts.reduce((total, p) => total + pick(p), 0));

    expect(sum((p) => p.kcal)).toBe(625);
    expect(sum((p) => p.grami)).toBe(360);
    expect(sum((p) => p.protein_g)).toBe(42);
    expect(sum((p) => p.mast_g)).toBe(47);
  });

  it("scales the piece size with the line, so the piece COUNT survives", () => {
    // 6 eggs of 50 g = 300 g, but the plate was really 270 g of egg.
    const [eggs] = normalizeSplit([part({ grami: 300 })], {
      ...meal,
      grams: 270,
      kcal: 405,
      protein: 32.4,
      carbs: 2.7,
      fat: 29.7,
    });

    expect(eggs.grami).toBe(270);
    expect(eggs.kom_grami).toBe(45);
    // Still six eggs -- just smaller ones -- rather than 5.4 of the old size.
    expect(Math.round(eggs.grami / (eggs.kom_grami ?? 1))).toBe(6);
  });

  it("spreads a nutrient the model zeroed out instead of losing it", () => {
    // Model claims 0 carbs everywhere, but the entry stores 6 g.
    const parts = normalizeSplit(
      [
        part({ uh_g: 0, grami: 300 }),
        part({ naziv: "Pavlaka", uh_g: 0, grami: 60, kcal: 175 }),
      ],
      meal
    );

    expect(Math.round(parts.reduce((t, p) => t + p.uh_g, 0))).toBe(6);
    // Split by mass: 300 g of 360 g carries five sixths of it.
    expect(parts[0].uh_g).toBeCloseTo(5, 0);
  });

  it("handles a single-food entry without distorting it", () => {
    const [wafer] = normalizeSplit(
      [
        part({
          naziv: "Napolitanka",
          kom_naziv: "komad",
          kom_grami: 45,
          kom_broj: 1,
          grami: 45,
          kcal: 234,
          protein_g: 2.7,
          uh_g: 28.8,
          mast_g: 11.7,
        }),
      ],
      { name: "Napolitanka", grams: 45, kcal: 234, protein: 2.7, carbs: 28.8, fat: 11.7 }
    );

    expect(wafer.kcal).toBe(234);
    expect(wafer.grami).toBe(45);
    expect(wafer.kom_grami).toBe(45);
  });
});
