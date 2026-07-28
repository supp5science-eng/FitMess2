import { describe, expect, it } from "vitest";

import { scaleMeal, HEALTHY_MEALS } from "@/lib/plan/healthy-meals";
import {
  rankSuggestionsForSlot,
  scoreMeal,
} from "@/lib/plan/suggest";

describe("scoreMeal", () => {
  it("penalises a protein gap more than an equal-kcal gap", () => {
    const meal = scaleMeal(
      HEALTHY_MEALS.find((m) => m.id === "piletina-pirinac-brokoli")!
    );
    const target = { kcal: meal.macros.kcal, proteinG: meal.macros.proteinG };
    const perfect = scoreMeal(meal, target);
    const offProtein = scoreMeal(meal, { ...target, proteinG: target.proteinG - 10 });
    const offKcal = scoreMeal(meal, { ...target, kcal: target.kcal - 100 });
    expect(perfect).toBeCloseTo(0, 5);
    expect(offProtein).toBeGreaterThan(offKcal);
  });
});

describe("rankSuggestionsForSlot", () => {
  it("returns only templates for the requested slot", () => {
    const results = rankSuggestionsForSlot("dorucak", { kcal: 400, proteinG: 25 });
    for (const meal of results) {
      expect(meal.slot).toBe("dorucak");
    }
  });

  it("ranks the closest macro fit first", () => {
    // Chicken/rice/broccoli sits at ~491 kcal / 44 g protein at factor 1.
    const results = rankSuggestionsForSlot("glavni", { kcal: 490, proteinG: 44 });
    expect(results[0]!.templateId).toBe("piletina-pirinac-brokoli");
  });

  it("respects excludeIds", () => {
    const results = rankSuggestionsForSlot(
      "glavni",
      { kcal: 490, proteinG: 44 },
      { excludeIds: ["piletina-pirinac-brokoli"] }
    );
    expect(results.map((m) => m.templateId)).not.toContain(
      "piletina-pirinac-brokoli"
    );
  });

  it("drops templates carrying an avoided tag", () => {
    const results = rankSuggestionsForSlot(
      "glavni",
      { kcal: 500, proteinG: 40 },
      { avoidTags: ["riba"] }
    );
    const ids = results.map((m) => m.templateId);
    expect(ids).not.toContain("losos-batat-spanac");
    expect(ids).not.toContain("tunjevina-krompir-grasak");
  });

  it("honours the limit", () => {
    const results = rankSuggestionsForSlot(
      "glavni",
      { kcal: 500, proteinG: 40 },
      { limit: 2 }
    );
    expect(results.length).toBe(2);
  });

  it("is deterministic (same input, same order)", () => {
    const a = rankSuggestionsForSlot("glavni", { kcal: 500, proteinG: 40 });
    const b = rankSuggestionsForSlot("glavni", { kcal: 500, proteinG: 40 });
    expect(a.map((m) => m.templateId)).toEqual(b.map((m) => m.templateId));
  });
});
