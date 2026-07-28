import { describe, expect, it } from "vitest";

import { computeMealPlan, planProgress, type PlanTarget } from "@/lib/plan/plan";

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
