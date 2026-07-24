import { describe, expect, it } from "vitest";

import { mealEstimateSchema, type MealEstimate } from "@/lib/ai/meal-estimate";
import { kcalFromMacros, reconcileEstimate } from "@/lib/ai/reconcile";

/** Build a valid estimate, overriding just what a test cares about. */
function estimate(patch: Partial<MealEstimate> = {}): MealEstimate {
  return mealEstimateSchema.parse({
    naziv: "Piletina sa pirinčem",
    sastojci: ["piletina", "pirinač"],
    komponente: [],
    procenjeni_grami: 340,
    kcal: 490,
    protein_g: 42,
    uh_g: 52,
    mast_g: 11,
    sigurnost: "srednja",
    napomena: "",
    ...patch,
  });
}

describe("kcalFromMacros", () => {
  it("applies the 4/4/9 Atwater factors", () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(10 * 4 + 20 * 4 + 5 * 9);
  });
});

describe("reconcileEstimate", () => {
  it("leaves a self-consistent estimate untouched", () => {
    // 42*4 + 52*4 + 11*9 = 475, vs stated 490 -> ~3% gap, inside tolerance.
    const { estimate: out, corrections } = reconcileEstimate(estimate());
    expect(corrections).toEqual([]);
    expect(out.kcal).toBe(490);
    expect(out.sigurnost).toBe("srednja");
  });

  it("rewrites calories that contradict the macros", () => {
    // Macros imply 475 kcal; the model claimed 900.
    const { estimate: out, corrections } = reconcileEstimate(
      estimate({ kcal: 900 })
    );
    expect(out.kcal).toBe(475);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toContain("Atwater");
  });

  it("prefers the component sum when it contradicts the stated total", () => {
    const { estimate: out, corrections } = reconcileEstimate(
      estimate({
        // Components add up to 300 g / 480 kcal...
        komponente: [
          { naziv: "piletina", grami: 150, kcal: 250, protein_g: 40, uh_g: 0, mast_g: 10 },
          { naziv: "pirinač", grami: 150, kcal: 230, protein_g: 5, uh_g: 50, mast_g: 1 },
        ],
        // ...but the model headlined 1200.
        kcal: 1200,
        protein_g: 45,
        uh_g: 50,
        mast_g: 11,
        procenjeni_grami: 300,
      })
    );
    expect(out.kcal).toBe(480);
    expect(out.protein_g).toBe(45);
    expect(out.procenjeni_grami).toBe(300);
    expect(corrections.some((c) => c.includes("components"))).toBe(true);
  });

  it("ignores a component list that clearly doesn't cover the plate", () => {
    // One 20 g side listed against a 340 g plate -- a partial list, not a
    // breakdown. Trusting its sum would wipe out most of the meal.
    const { estimate: out } = reconcileEstimate(
      estimate({
        komponente: [
          { naziv: "kečap", grami: 20, kcal: 25, protein_g: 0, uh_g: 6, mast_g: 0 },
        ],
      })
    );
    expect(out.kcal).toBe(490);
    expect(out.procenjeni_grami).toBe(340);
  });

  it("downgrades 'visoka' confidence when it had to intervene", () => {
    const { estimate: out } = reconcileEstimate(
      estimate({ kcal: 900, sigurnost: "visoka" })
    );
    expect(out.sigurnost).toBe("srednja");
  });

  it("keeps stated calories when there are no macros to check against", () => {
    const { estimate: out, corrections } = reconcileEstimate(
      estimate({ kcal: 300, protein_g: 0, uh_g: 0, mast_g: 0 })
    );
    expect(out.kcal).toBe(300);
    expect(corrections).toEqual([]);
  });

  it("never emits a zero portion weight", () => {
    const { estimate: out } = reconcileEstimate(
      estimate({ procenjeni_grami: 0.2 })
    );
    expect(out.procenjeni_grami).toBeGreaterThanOrEqual(1);
  });
});
