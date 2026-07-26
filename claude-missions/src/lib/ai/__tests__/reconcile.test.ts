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

describe("reconcileEstimate — micronutrients follow the mass", () => {
  /** A plate whose breakdown says it is much lighter than the headline mass. */
  const overstated = () =>
    estimate({
      procenjeni_grami: 600,
      kcal: 900,
      protein_g: 60,
      uh_g: 90,
      mast_g: 40,
      vlakna_g: 12,
      secer_g: 20,
      natrijum_mg: 1200,
      zasicene_g: 10,
      // Sums to 480 g -- inside the 70-135% band, so the breakdown is treated
      // as covering the whole plate and its numbers win.
      komponente: [
        {
          naziv: "piletina",
          grami: 240,
          kcal: 260,
          protein_g: 48,
          uh_g: 0,
          mast_g: 7,
        },
        {
          naziv: "pirinač",
          grami: 240,
          kcal: 300,
          protein_g: 6,
          uh_g: 66,
          mast_g: 1,
        },
      ],
    });

  it("rescales the micros when the breakdown rewrites the plate's mass", () => {
    const { estimate: out, corrections } = reconcileEstimate(overstated());
    expect(corrections.length).toBeGreaterThan(0);
    // 600 g -> 480 g, so four fifths of everything the model attributed to it.
    expect(out.procenjeni_grami).toBe(480);
    expect(out.natrijum_mg).toBe(960);
    expect(out.vlakna_g).toBe(9.6);
  });

  it("leaves the micros alone when the mass didn't change", () => {
    const { estimate: out } = reconcileEstimate(
      estimate({ vlakna_g: 7, natrijum_mg: 500 })
    );
    expect(out.vlakna_g).toBe(7);
    expect(out.natrijum_mg).toBe(500);
  });

  it("keeps unknown micros unknown at any mass", () => {
    const { estimate: out } = reconcileEstimate(
      estimate({ ...overstated(), vlakna_g: null, natrijum_mg: null })
    );
    expect(out.vlakna_g).toBeNull();
    expect(out.natrijum_mg).toBeNull();
  });
});
