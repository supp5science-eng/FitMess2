import { z } from "zod";

import {
  AGENT_ACTION_IDS,
  describeAgentActions,
} from "@/lib/ai/agent-actions";
import { buildAgentMealDraft } from "@/lib/ai/agent-draft";
import { GRIC_RULES, VARIANCE_VALUES } from "@/lib/ai/gric-estimate";
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
 *
 * Izvršni put (2026-08-26): a turn may now also carry `unos` — a PROPOSED meal
 * entry. That is a proposal and nothing more; this module and the chat route
 * write nothing. See `agent-draft.ts` for the draft -> confirm -> write path
 * and why the numbers on the confirm screen are the numbers that get stored.
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

/**
 * What Jarvis's turn comes back as: the spoken reply, up to three action ids
 * from the catalog, and — when the user just said what they ate — a MEAL DRAFT.
 * Zod re-validates what the model returned (the response schema constrains it,
 * but the parse is the contract) and an unknown id is DROPPED rather than
 * failing the turn — a hallucinated action costs a card, never the answer.
 *
 * `unos` gets the same treatment through `buildAgentMealDraft`: a malformed or
 * empty proposal becomes `null`, so a model that gets the draft wrong costs the
 * draft and the user still gets their answer. Nothing here writes anything —
 * the draft is a proposal until the user confirms it and the client posts it to
 * `/api/ai/agent/unos` (see `agent-draft.ts`).
 */
export const agentModelReplySchema = z.object({
  reply: z.string().trim().min(1),
  actions: z
    .array(z.string())
    .max(3)
    .optional()
    .transform((ids) =>
      (ids ?? []).filter((id): id is (typeof AGENT_ACTION_IDS)[number] =>
        (AGENT_ACTION_IDS as readonly string[]).includes(id)
      )
    ),
  unos: z
    .unknown()
    .optional()
    .transform((raw) => buildAgentMealDraft(raw)),
});

/**
 * The proposed-entry field, in both dialects.
 *
 * Same SHAPE as Gric's own answer (`GRIC_RESPONSE_SCHEMA`) — occasions
 * nested, `grami` before the macros — because it is parsed by Gric's own
 * `parseGricResponse` (via `buildAgentMealDraft`). Written out here rather
 * than imported because Claude needs the lowercase JSON-Schema dialect and
 * Gric only ever needed Gemini's; the two stay in step through
 * `agent-draft.test.ts`, which parses a fixture built from these fields.
 *
 * Nesting (rather than a `grupa` number per item) makes the model decide how
 * many plates there were BEFORE it writes any item — see the note on
 * `GRIC_RESPONSE_SCHEMA`.
 */
const DRAFT_ITEM_FIELDS = [
  "naziv",
  "kolicina",
  "grami",
  "kcal",
  "protein_g",
  "uh_g",
  "mast_g",
  "varijansa",
] as const;

const DRAFT_ITEM_SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    naziv: { type: "STRING" },
    kolicina: { type: "STRING" },
    grami: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    uh_g: { type: "NUMBER" },
    mast_g: { type: "NUMBER" },
    varijansa: { type: "STRING", enum: [...VARIANCE_VALUES] },
  },
  required: [...DRAFT_ITEM_FIELDS],
  propertyOrdering: [...DRAFT_ITEM_FIELDS],
} as const;

const DRAFT_SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    obroci: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          stavke: { type: "ARRAY", items: DRAFT_ITEM_SCHEMA_GEMINI },
        },
        required: ["stavke"],
        propertyOrdering: ["stavke"],
      },
    },
  },
  required: ["obroci"],
  propertyOrdering: ["obroci"],
} as const;

const DRAFT_ITEM_SCHEMA_JSON = {
  type: "object",
  properties: {
    naziv: { type: "string" },
    kolicina: { type: "string" },
    grami: { type: "number" },
    kcal: { type: "number" },
    protein_g: { type: "number" },
    uh_g: { type: "number" },
    mast_g: { type: "number" },
    varijansa: { type: "string", enum: [...VARIANCE_VALUES] },
  },
  required: [...DRAFT_ITEM_FIELDS],
  additionalProperties: false,
} as const;

const DRAFT_SCHEMA_JSON = {
  type: "object",
  properties: {
    obroci: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stavke: { type: "array", items: DRAFT_ITEM_SCHEMA_JSON },
        },
        required: ["stavke"],
        additionalProperties: false,
      },
    },
  },
  required: ["obroci"],
  additionalProperties: false,
} as const;

/** Gemini response schema for one Jarvis turn (uppercase types, per the
 * estimator convention in `gric-estimate.ts` and friends). */
export const AGENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: { type: "STRING", enum: [...AGENT_ACTION_IDS] },
    },
    unos: DRAFT_SCHEMA_GEMINI,
  },
  required: ["reply"],
  propertyOrdering: ["reply", "actions", "unos"],
} as const;

/** The same contract as standard JSON Schema, for Claude's
 * `output_config.format` — one schema per dialect because Gemini's uppercase
 * variant is not valid JSON Schema and Claude rejects it. Both feed the same
 * `agentModelReplySchema` parse, which stays the single arbiter. */
export const AGENT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      // No `maxItems`: the API rejects it inside `output_config.format`
      // (400, verified live 2026-08-25). The three-card cap lives in the
      // prompt and in `agentModelReplySchema`, same as on the Gemini side.
      items: { type: "string", enum: [...AGENT_ACTION_IDS] },
    },
    unos: DRAFT_SCHEMA_JSON,
  },
  required: ["reply"],
  additionalProperties: false,
} as const;

/** Everything the route computed about the user's day, ready to phrase. */
export interface AgentFacts {
  /** The user's first name (from `profiles.full_name`), for the personal
   * register — `null` when they never gave one. */
  name: string | null;
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
  if (facts.name) lines.push(`Ime korisnika: ${facts.name}`);
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
 * The one part of the prompt that can move data.
 *
 * Two things are load-bearing here and neither is decoration:
 *
 * 1. **The estimation rules are Gric's**, imported verbatim. Jarvis is a third
 *    mouth for the same job, and if these rules were rewritten here a "šaka
 *    semenki" would weigh one thing said to Jarvis and another said to Gric —
 *    the day's total would depend on which screen the user was on.
 * 2. **She may propose, never announce.** The model has no way to write
 *    anything: the draft is returned to the client, shown, and only a POST to
 *    `/api/ai/agent/unos` (which never calls a model) writes it. But a reply
 *    that SAYS "upisala sam" when nothing was written is its own kind of lie,
 *    so the wording is constrained too, not just the wiring.
 */
const DRAFT_RULES = `UNOS OBROKA (jedina stvar koju ti upisuješ — i NIKAD bez potvrde):
- Kad korisnik KAŽE šta je pojeo ili popio ("dva jaja i jogurt", "pojeo sam burek", "popio sam kafu sa mlekom"), ne šalji ga nigde — sam napravi predlog unosa u polju "unos".
- "unos" je PREDLOG, ne upis. Aplikacija ga pokaže korisniku, on potvrdi, i tek tada se upisuje u dnevnik.
- Zato NIKAD ne piši da si nešto upisala, sačuvala, dodala ili zabeležila. Reci da si spremila predlog i čekaš potvrdu (npr. "Evo procene — potvrdi pa upisujem."). Isto važi i kad si sigurna u brojeve.
- U "reply" nemoj da nabrajaš stavke i brojeve iz predloga — korisnik ih vidi na ekranu. Reci kratko šta si razumela i, ako je korisno, kako to stoji sa današnjim ciljem.
- Ako korisnik samo PITA ili planira ("šta da jedem", "koliko kalorija ima burek", "da li mi je dosta proteina"), to nije unos — nemoj praviti "unos".
- Ako u poruci nema hrane ni pića, polje "unos" potpuno izostavi.
- Brisanje i izmena već upisanih obroka još ne postoje. Ako korisnik to traži, reci to kratko i bez izvinjavanja, pa ponudi akciju danas.

Oblik polja "unos": {"obroci": [{"stavke": [...]}]} — po sledećim pravilima:

${GRIC_RULES}`;

/**
 * The persona + rules + action catalog + fact sheet. Zero-shame is a hard
 * rule here for the same reason `--chart-5` is never `--destructive`: going
 * over target gets framed as information, never as failure.
 */
export function buildAgentSystemPrompt(facts: AgentFacts): string {
  return `Ti si Jarvis — lični AI trener u aplikaciji FitMess. Korisnik NE navigira aplikacijom: kaže tebi šta hoće, ti odgovoriš i DONESEŠ mu pravu stvar kao akciju. Pričaš na srpskom (pismo i ton korisnika prati), toplo, direktno i bez osuđivanja ("zero-shame": preskočen obrok ili prekoračenje NIKAD nije "greh" ni razlog za grižu savesti — jedan dan ne ruši nedelju).

LIČNI TON:
- Ako znaš ime, povremeno oslovi korisnika po imenu — prirodno, ne u svakoj poruci.
- Vezuj odgovore za NJEGOVE brojeve i cilj ("ostalo ti je 650", "proteini ti kasne"), nikad generičke fraze koje bi važile svakome.

AKCIJE:
Odgovaraš u JSON-u: "reply" (tvoj tekst) + opciono "actions" (do 3 id-ja iz kataloga) + opciono "unos" (predlog obroka, vidi dole).
- Kad korisnikova poruka TRAŽI radnju (da vidi analitiku, upiše težinu, otvori podešavanja...), ponudi odgovarajuće akcije — NIKAD ne objašnjavaj gde se šta klikće i ne pominji tabove.
- Kad korisnik hoće da loguje obrok koji TREBA da se slika (tačnost mu je bitna, ili ne ume da opiše šta je u tanjiru), nudi prizma_unos prvo (najtačnije), pa slikaj_obrok.
- NE nudi akciju "gric" kad si već napravila "unos" — to je isti posao dvaput.
- Kad je poruka samo pitanje/razgovor, "actions" izostavi ili ostavi prazno. Akcija je ponuda, ne obaveza.
Katalog:
${describeAgentActions()}

${DRAFT_RULES}

PRAVILA:
- "reply" kratko: 2-5 rečenica, bez lista osim kad korisnik traži plan/predloge.
- Brojevi ispod su IZVOR ISTINE. Ne izmišljaj i ne preračunavaj tuđe brojeve; svoje predloge (npr. šta pojesti) slobodno proceni okvirno i reci da je procena.
- Ako podatak ne postoji u listi, reci iskreno da ga još nemaš i ponudi akciju kojom se unosi.
- Nisi lekar: za zdravstvene tegobe, lekove ili dijagnoze uputi na lekara, kratko i bez drame.
- Ostani na temama: ishrana, obroci, voda, kretanje, plan, navike, podaci korisnika. Za sve ostalo reci da si tu za ishranu i dan korisnika.
- Ako korisnik piše na engleskom, odgovori na engleskom.

DANAŠNJI PODACI KORISNIKA:
${formatAgentFacts(facts)}`;
}
