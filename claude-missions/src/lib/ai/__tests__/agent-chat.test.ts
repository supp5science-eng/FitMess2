import { describe, expect, it } from "vitest";

import {
  agentRequestSchema,
  buildAgentSystemPrompt,
  formatAgentFacts,
  type AgentFacts,
} from "@/lib/ai/agent-chat";

function makeFacts(overrides: Partial<AgentFacts> = {}): AgentFacts {
  return {
    day: "2026-08-25",
    goal: "lose",
    targetKcal: 1900,
    targetProteinG: 140,
    targetFatG: 60,
    targetCarbsG: 190,
    eatenKcal: 1250,
    eatenProteinG: 82,
    eatenFatG: 41,
    eatenCarbsG: 118,
    meals: [
      { name: "Pileći file sa pirinčem", kcal: 620 },
      { name: "Jogurt", kcal: 118 },
    ],
    waterMl: 1200,
    waterGoalMl: 2400,
    profile: { sex: "male", weightKg: 92, heightCm: 183, birthYear: 1995 },
    ...overrides,
  };
}

describe("agent facts sheet", () => {
  it("states the target, the eaten totals and the remaining kcal", () => {
    const sheet = formatAgentFacts(makeFacts());
    expect(sheet).toContain("Dnevni cilj: 1900 kcal");
    expect(sheet).toContain("Uneto danas: 1250 kcal");
    expect(sheet).toContain("Preostalo danas: 650 kcal");
    expect(sheet).toContain("Pileći file sa pirinčem (620 kcal)");
    expect(sheet).toContain("Voda danas: 1200 ml od cilja 2400 ml");
  });

  it("says honestly when there is no target and no meals yet", () => {
    const sheet = formatAgentFacts(
      makeFacts({
        targetKcal: null,
        meals: [],
        waterMl: null,
        goal: null,
      })
    );
    expect(sheet).toContain("Dnevni cilj: još nije izračunat");
    expect(sheet).toContain("Obroci danas: još ništa nije uneto");
    expect(sheet).toContain("Cilj: nije postavljen");
    expect(sheet).not.toContain("Preostalo danas");
    expect(sheet).not.toContain("Voda danas");
  });

  it("system prompt carries the zero-shame rule and the fact sheet", () => {
    const prompt = buildAgentSystemPrompt(makeFacts());
    expect(prompt).toContain("zero-shame");
    expect(prompt).toContain("IZVOR ISTINE");
    expect(prompt).toContain("Dnevni cilj: 1900 kcal");
    // Not a doctor -- the health hand-off must be in the standing rules.
    expect(prompt).toContain("Nisi lekar");
  });
});

describe("agent request schema", () => {
  it("accepts a running conversation ending on the user", () => {
    const parsed = agentRequestSchema.safeParse({
      turns: [
        { role: "user", text: "Kako stojim danas?" },
        { role: "model", text: "Dobro si — ostalo ti je 650 kcal." },
        { role: "user", text: "Šta da pojedem za večeru?" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty, oversized and malformed turns", () => {
    expect(agentRequestSchema.safeParse({ turns: [] }).success).toBe(false);
    expect(
      agentRequestSchema.safeParse({
        turns: [{ role: "user", text: "" }],
      }).success
    ).toBe(false);
    expect(
      agentRequestSchema.safeParse({
        turns: [{ role: "system", text: "hak" }],
      }).success
    ).toBe(false);
    expect(
      agentRequestSchema.safeParse({
        turns: [{ role: "user", text: "x".repeat(2001) }],
      }).success
    ).toBe(false);
  });
});
