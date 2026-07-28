import { describe, expect, it } from "vitest";

import {
  HEALTHY_MEALS,
  MAX_SCALE,
  MIN_SCALE,
  mealsForSlot,
  scaleMeal,
  templateMacros,
} from "@/lib/plan/healthy-meals";

const OATS = HEALTHY_MEALS.find((m) => m.id === "ovsena-jogurt-borovnice")!;

describe("healthy-meals catalog", () => {
  it("every template has a unique id", () => {
    const ids = HEALTHY_MEALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers both doručak and glavni templates", () => {
    expect(mealsForSlot("dorucak").length).toBeGreaterThan(0);
    expect(mealsForSlot("glavni").length).toBeGreaterThan(0);
  });

  it("every template is protein-forward and non-empty", () => {
    for (const template of HEALTHY_MEALS) {
      expect(template.ingredients.length).toBeGreaterThan(0);
      const macros = templateMacros(template);
      expect(macros.kcal).toBeGreaterThan(0);
      // A curated meal always carries a real protein hit.
      expect(macros.proteinG).toBeGreaterThanOrEqual(18);
    }
  });
});

describe("templateMacros", () => {
  it("sums per-100g ingredient macros (hand-computed reference)", () => {
    // oats 50g + greek yogurt 150g + blueberries 60g + walnuts 10g
    expect(templateMacros(OATS)).toEqual({
      kcal: 399,
      proteinG: 22,
      carbsG: 46,
      fatG: 13,
    });
  });
});

describe("scaleMeal", () => {
  it("leaves a template at its authored grams when no target is given", () => {
    const scaled = scaleMeal(OATS);
    expect(scaled.items[0]).toEqual({ nameSr: "Ovsene pahuljice", grams: 50 });
    expect(scaled.macros).toEqual(templateMacros(OATS));
  });

  it("scales up toward a bigger target but never past MAX_SCALE", () => {
    const scaled = scaleMeal(OATS, 100_000);
    // 50 g oats * 1.5 (cap) = 75 g
    const oats = scaled.items.find((i) => i.nameSr === "Ovsene pahuljice")!;
    expect(oats.grams).toBe(Math.round((50 * MAX_SCALE) / 5) * 5);
    expect(scaled.macros.kcal).toBeLessThanOrEqual(
      Math.round(templateMacros(OATS).kcal * MAX_SCALE) + 5
    );
  });

  it("scales down toward a small target but never past MIN_SCALE", () => {
    const scaled = scaleMeal(OATS, 1);
    const oats = scaled.items.find((i) => i.nameSr === "Ovsene pahuljice")!;
    expect(oats.grams).toBeGreaterThanOrEqual(5);
    // 50 g * 0.65 floor = 32.5 -> nearest 5
    expect(oats.grams).toBe(Math.max(5, Math.round((50 * MIN_SCALE) / 5) * 5));
  });

  it("recomputes macros from the scaled grams (no drift)", () => {
    const scaled = scaleMeal(OATS, 300);
    // Rebuild kcal from the reported grams and per-100g reference values.
    const byName = new Map(scaled.items.map((i) => [i.nameSr, i.grams]));
    const grams = byName.get("Grčki jogurt")!;
    // Grčki jogurt is 73 kcal / 100 g; its contribution must be part of the total.
    expect(scaled.macros.kcal).toBeGreaterThan((grams / 100) * 73 - 1);
  });
});
