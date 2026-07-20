import { describe, expect, it } from "vitest";

import {
  buildLofiSnapshot,
  buildLofiSystemPrompt,
  LOFI_GREETING,
  LOFI_SUGGESTIONS,
} from "@/lib/ai/lofi";
import type { Log, Target } from "@/lib/types/db";

function makeTarget(overrides: Partial<Target> = {}): Target {
  return {
    id: "t1",
    user_id: "u1",
    daily_kcal: 2000,
    protein_g: 150,
    fat_g: 60,
    carbs_g: 200,
    weekly_kcal: 14000,
    goal: "lose",
    goal_weight_kg: 80,
    timeframe_weeks: 12,
    effective_from: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLog(kcal: number, protein: number, carbs: number, fat: number): Pick<
  Log,
  "kcal" | "protein" | "carbs" | "fat"
> {
  return { kcal, protein, carbs, fat };
}

describe("buildLofiSnapshot", () => {
  it("returns an empty, no-target snapshot when there is no target row", () => {
    const snap = buildLofiSnapshot(null, [makeLog(500, 30, 40, 15)]);
    expect(snap.hasTarget).toBe(false);
    expect(snap.remainingKcal).toBe(0);
    expect(snap.mealsLogged).toBe(1);
  });

  it("computes remaining kcal + macros from target minus logged totals", () => {
    const snap = buildLofiSnapshot(makeTarget(), [
      makeLog(700, 40, 60, 20),
      makeLog(300, 20, 30, 10),
    ]);
    expect(snap.hasTarget).toBe(true);
    expect(snap.consumedKcal).toBe(1000);
    expect(snap.remainingKcal).toBe(1000);
    expect(snap.isOver).toBe(false);
    // protein 150 - 60 = 90, carbs 200 - 90 = 110, fat 60 - 30 = 30
    expect(snap.remaining).toEqual({ protein: 90, carbs: 110, fat: 30 });
    expect(snap.goal).toBe("lose");
  });

  it("clamps remaining macros at 0 and flags overshoot when over budget", () => {
    const snap = buildLofiSnapshot(makeTarget({ daily_kcal: 1000 }), [
      makeLog(1400, 200, 250, 90),
    ]);
    expect(snap.isOver).toBe(true);
    expect(snap.remainingKcal).toBe(0);
    expect(snap.overshootKcal).toBe(400);
    expect(snap.remaining).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("buildLofiSystemPrompt", () => {
  it("embeds the live numbers and the user's name", () => {
    const snap = buildLofiSnapshot(makeTarget(), [makeLog(800, 50, 70, 25)]);
    const prompt = buildLofiSystemPrompt(snap, "Ana");
    expect(prompt).toContain("Lofi");
    expect(prompt).toContain("Ana");
    expect(prompt).toContain("1200 kcal"); // remaining (2000 - 800)
    expect(prompt).toContain("mršavljenje");
  });

  it("tells Lofi the plan is missing when there is no target", () => {
    const prompt = buildLofiSystemPrompt(buildLofiSnapshot(null, []), null);
    expect(prompt).toContain("NIJE podesio");
  });

  it("ships a greeting and starter suggestions", () => {
    expect(LOFI_GREETING).toContain("Lofi");
    expect(LOFI_SUGGESTIONS.length).toBeGreaterThan(2);
  });
});
