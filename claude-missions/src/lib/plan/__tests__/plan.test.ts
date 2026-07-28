import { describe, expect, it } from "vitest";

import { HEALTHY_MEALS } from "@/lib/plan/healthy-meals";
import { computeMealPlan, planProgress, type PlanTarget } from "@/lib/plan/plan";

const DORUCAK_NAME = HEALTHY_MEALS.find((m) => m.slot === "dorucak")!.nameSr;
const GLAVNI_NAME = HEALTHY_MEALS.find((m) => m.slot === "glavni")!.nameSr;

const TARGET: PlanTarget = {
  dailyKcal: 2000,
  proteinG: 128,
  carbsG: 200,
  fatG: 60,
};

const NOTHING_EATEN = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

describe("planProgress", () => {
  it("suggests two meals for a normal protein target, nothing covered yet", () => {
    const p = planProgress({ target: TARGET, consumed: NOTHING_EATEN });
    expect(p.suggestedCount).toBe(2);
    expect(p.mealsDone).toBe(0);
    // reserved = (0.28 + 0.37) * 2000 = 1300 -> free = 700
    expect(p.freeRoomKcal).toBe(700);
    expect(p.proteinTargetG).toBe(128);
  });

  it("covers the first meal once enough protein is logged", () => {
    // meal 1 cumulative protein target = 0.35 * 128 = 44.8
    const p = planProgress({
      target: TARGET,
      consumed: { ...NOTHING_EATEN, kcal: 500, proteinG: 50 },
    });
    expect(p.mealsDone).toBe(1);
    // only meal 2 reserved (0.37 * 2000 = 740) -> free = 2000 - 500 - 740 = 760
    expect(p.freeRoomKcal).toBe(760);
  });

  it("covers both meals once the protein floor is reached", () => {
    // both cumulative = (0.35 + 0.45) * 128 = 102.4
    const p = planProgress({
      target: TARGET,
      consumed: { ...NOTHING_EATEN, kcal: 900, proteinG: 110 },
    });
    expect(p.mealsDone).toBe(2);
    expect(p.freeRoomKcal).toBe(2000 - 900);
  });

  it("suggests a single meal for a small protein target", () => {
    const p = planProgress({
      target: { ...TARGET, proteinG: 90 },
      consumed: NOTHING_EATEN,
    });
    expect(p.suggestedCount).toBe(1);
  });

  it("never returns negative free room", () => {
    const p = planProgress({
      target: TARGET,
      consumed: { ...NOTHING_EATEN, kcal: 5000, proteinG: 200 },
    });
    expect(p.freeRoomKcal).toBe(0);
  });
});

describe("computeMealPlan", () => {
  it("fills ranked suggestions for uncovered meals only", () => {
    const plan = computeMealPlan({ target: TARGET, consumed: NOTHING_EATEN });
    expect(plan.slots).toHaveLength(2);
    expect(plan.slots[0]!.done).toBe(false);
    expect(plan.slots[0]!.suggestions.length).toBeGreaterThan(0);
    expect(plan.slots[0]!.slot).toBe("dorucak");
    expect(plan.slots[1]!.slot).toBe("glavni");
  });

  it("leaves covered meals without suggestions", () => {
    const plan = computeMealPlan({
      target: TARGET,
      consumed: { ...NOTHING_EATEN, kcal: 900, proteinG: 110 },
    });
    expect(plan.mealsDone).toBe(2);
    for (const slot of plan.slots) {
      expect(slot.done).toBe(true);
      expect(slot.suggestions).toHaveLength(0);
    }
  });

  it("keeps a swap list of more than one option per uncovered meal", () => {
    const plan = computeMealPlan({ target: TARGET, consumed: NOTHING_EATEN });
    expect(plan.slots[1]!.suggestions.length).toBeGreaterThan(1);
  });

  it("targets protein first: each suggested meal carries a real protein dose", () => {
    const plan = computeMealPlan({ target: TARGET, consumed: NOTHING_EATEN });
    for (const slot of plan.slots) {
      expect(slot.suggestions[0]!.macros.proteinG).toBeGreaterThanOrEqual(20);
    }
  });
});

describe("logged-suggestion coverage", () => {
  it("marks a meal done once its suggestion is logged, even below the protein threshold", () => {
    // Only 20 g protein logged (well below any cumulative threshold), but the
    // logged NAME matches a curated doručak meal -> that meal is covered.
    const p = planProgress({
      target: TARGET,
      consumed: { kcal: 400, proteinG: 20, carbsG: 40, fatG: 12 },
      loggedMealNames: [DORUCAK_NAME],
    });
    expect(p.mealsDone).toBe(1);
  });

  it("computeMealPlan drops suggestions for the logged slot only", () => {
    const plan = computeMealPlan({
      target: TARGET,
      consumed: NOTHING_EATEN,
      loggedMealNames: [GLAVNI_NAME],
    });
    const glavni = plan.slots.find((s) => s.slot === "glavni")!;
    const dorucak = plan.slots.find((s) => s.slot === "dorucak")!;
    expect(glavni.done).toBe(true);
    expect(glavni.suggestions).toHaveLength(0);
    expect(dorucak.done).toBe(false);
    expect(dorucak.suggestions.length).toBeGreaterThan(0);
  });

  it("ignores logged names that are not curated meals", () => {
    const p = planProgress({
      target: TARGET,
      consumed: NOTHING_EATEN,
      loggedMealNames: ["Pljeskavica sa kajmakom"],
    });
    expect(p.mealsDone).toBe(0);
  });
});
