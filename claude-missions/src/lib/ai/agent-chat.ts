import { z } from "zod";

import type { GoalType } from "@/lib/types/db";

/**
 * FitMess agent (redesign 2026-08-25, faza 2) — the AI tab's chat brain.
 *
 * This module is the PURE half of the agent: the request schema, the fact
 * sheet the model is handed, and the persona prompt. The route
 * (`/api/ai/agent`) gathers live data and calls Gemini; everything here is
 * testable without a database or a model.
 *
 * The design stance mirrors `/api/merenje/poruka`: every number the agent is
 * allowed to say is computed HERE from stored data and injected into the
 * system prompt. The model's job is to talk about those numbers warmly, not
 * to invent new ones.
 */

/** One chat turn as the client sends it (mirrors Gemini's `ChatTurn`). */
export const agentTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1).max(2000),
});

/** The request body: the running conversation, newest last, ending on the
 * user's message. Capped so a runaway client can't ship a novel. */
export const agentRequestSchema = z.object({
  turns: z.array(agentTurnSchema).min(1).max(24),
});

export type AgentTurn = z.infer<typeof agentTurnSchema>;

/** Everything the route computed about the user's day, ready to phrase. */
export interface AgentFacts {
  /** Belgrade calendar day ("2026-08-25"). */
  day: string;
  goal: GoalType | null;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetFatG: number | null;
  targetCarbsG: number | null;
  eatenKcal: number;
  eatenProteinG: number;
  eatenFatG: number;
  eatenCarbsG: number;
  /** Today's meals, in log order. */
  meals: { name: string; kcal: number }[];
  waterMl: number | null;
  waterGoalMl: number | null;
  profile: {
    sex: "male" | "female" | null;
    weightKg: number | null;
    heightCm: number | null;
    birthYear: number | null;
  };
}

const GOAL_SR: Record<GoalType, string> = {
  maintain: "održavanje težine",
  lose: "mršavljenje (kalorijski deficit)",
  gain: "dobijanje mase (kalorijski suficit)",
  tone: "zatezanje/rekompozicija",
};

/** The injected fact sheet — plain Serbian lines the model must treat as the
 * source of truth. Absent values say so explicitly, so the model can honestly
 * answer "nemam taj podatak" instead of hallucinating one. */
export function formatAgentFacts(facts: AgentFacts): string {
  const lines: string[] = [];
  lines.push(`Datum: ${facts.day}`);
  lines.push(`Cilj: ${facts.goal ? GOAL_SR[facts.goal] : "nije postavljen"}`);
  if (facts.targetKcal && facts.targetKcal > 0) {
    const macros =
      facts.targetProteinG || facts.targetFatG || facts.targetCarbsG
        ? ` (proteini ${facts.targetProteinG ?? "?"} g, masti ${
            facts.targetFatG ?? "?"
          } g, ugljeni hidrati ${facts.targetCarbsG ?? "?"} g)`
        : "";
    lines.push(`Dnevni cilj: ${facts.targetKcal} kcal${macros}`);
    lines.push(
      `Preostalo danas: ${Math.round(facts.targetKcal - facts.eatenKcal)} kcal`
    );
  } else {
    lines.push("Dnevni cilj: još nije izračunat");
  }
  lines.push(
    `Uneto danas: ${Math.round(facts.eatenKcal)} kcal (proteini ${Math.round(
      facts.eatenProteinG
    )} g, masti ${Math.round(facts.eatenFatG)} g, ugljeni hidrati ${Math.round(
      facts.eatenCarbsG
    )} g)`
  );
  lines.push(
    facts.meals.length === 0
      ? "Obroci danas: još ništa nije uneto"
      : `Obroci danas: ${facts.meals
          .map((meal) => `${meal.name} (${Math.round(meal.kcal)} kcal)`)
          .join(", ")}`
  );
  if (facts.waterMl !== null && facts.waterGoalMl) {
    lines.push(`Voda danas: ${facts.waterMl} ml od cilja ${facts.waterGoalMl} ml`);
  }
  const p = facts.profile;
  const profileBits = [
    p.sex === "male" ? "muško" : p.sex === "female" ? "žensko" : null,
    p.weightKg ? `${p.weightKg} kg` : null,
    p.heightCm ? `${p.heightCm} cm` : null,
    p.birthYear ? `rođen(a) ${p.birthYear}.` : null,
  ].filter(Boolean);
  if (profileBits.length > 0) lines.push(`Profil: ${profileBits.join(", ")}`);
  return lines.join("\n");
}

/**
 * The persona + rules + fact sheet. Zero-shame is a hard rule here for the
 * same reason `--chart-5` is never `--destructive`: going over target gets
 * framed as information, never as failure.
 */
export function buildAgentSystemPrompt(facts: AgentFacts): string {
  return `Ti si FitMess AI — lični trener ishrane u aplikaciji FitMess. Pričaš na srpskom (ijekavicu i latinicu korisnika prati), toplo, direktno i bez osuđivanja ("zero-shame": preskočen obrok ili prekoračenje NIKAD nije "greh" ni razlog za grižu savesti — jedan dan ne ruši nedelju).

PRAVILA:
- Odgovaraj kratko: 2-5 rečenica, bez lista osim kad korisnik traži plan/predloge.
- Brojevi ispod su IZVOR ISTINE. Ne izmišljaj i ne preračunavaj tuđe brojeve; svoje predloge (npr. šta pojesti) slobodno proceni okvirno i reci da je procena.
- Ako podatak ne postoji u listi, reci iskreno da ga još nemaš i predloži gde se unosi u aplikaciji.
- Nisi lekar: za zdravstvene tegobe, lekove ili dijagnoze uputi na lekara, kratko i bez drame.
- Ostani na temama: ishrana, obroci, voda, kretanje, plan, navike, podaci korisnika. Za sve ostalo reci da si tu za ishranu i dan korisnika.
- Ako korisnik piše na engleskom, odgovori na engleskom.

DANAŠNJI PODACI KORISNIKA:
${formatAgentFacts(facts)}`;
}
