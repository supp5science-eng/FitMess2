import { z } from "zod";

import {
  MAX_EXTRA_AMOUNT,
  MAX_EXTRA_DESCRIPTION,
} from "@/lib/ai/extra-limits";
import { postJsonPrompt } from "@/lib/ai/micro-estimate";
import { foodEmoji } from "@/lib/food/emoji";
import type { ExtraFood } from "@/lib/log/extras";

/**
 * FREE-TEXT EXTRA (2026-08-01): "napiši šta si još pojeo/la i koliko".
 *
 * ## Why this replaced catalog search
 *
 * The "Dodaj još" sheet used to offer `Pretraži` for anything outside its ten
 * curated chips. That search runs against 350 curated foods -- excellent
 * coverage for staples, and a dead end for everything else a person actually
 * reaches for after the photo. A search that answers "nema u katalogu" teaches
 * the user that the feature does not work, and the calories quietly go
 * unlogged, which is the exact failure "Dodaj još" exists to prevent.
 *
 * So the box no longer looks anything up: it takes what the user WROTE plus how
 * much of it, and asks the model. Anything sayable is loggable -- "kašika
 * tartar sosa", "pola pite od višanja", "dva pufnasta štapića" -- and the
 * catalog stays what it is good at (the chips, the barcode scanner, portions).
 *
 * ## Shape of the answer: a virtual catalog row
 *
 * The model returns PER-100 g values plus a natural unit (`kom_naziv`,
 * `kom_grami`) and how many of them the user described (`kom_broj`). That is
 * exactly an `ExtraFood` plus a tap count, so an AI-estimated extra flows
 * through `applyAddMore` down the SAME path as a chip -- one stepper row, one
 * unit per tap, micronutrients from its own per-100 g figures. No second code
 * path, and "+1" after the fact means one more spoon rather than one more of
 * whatever the user happened to type.
 *
 * Per-100 g rather than "total for what I ate" is deliberate: it is the form
 * the model is most reliable at (it is reading a nutrition table from memory),
 * and it makes the amount and the food independent -- correcting the count
 * later cannot corrupt the food.
 */

/** The user is waiting behind a spinner inside an open sheet, so the leash is
 * short: a slow answer here is worse than no answer, because the steppers and
 * chips behind it still work. */
const EXTRA_TIMEOUT_MS = 10_000;
const EXTRA_MAX_TOKENS = 700;
/** One quick retry, for the per-minute quota (429) that clears in seconds. */
const EXTRA_RETRY_DELAY_MS = 1_500;

export const extraQuerySchema = z.object({
  /** What they ate ("majonez", "pita od višanja"). */
  opis: z.string().trim().min(2).max(MAX_EXTRA_DESCRIPTION),
  /** How much ("2 kašike", "pola šolje", "100 g"). Optional -- an empty box
   * means "a normal serving", which the model is asked to assume out loud. */
  kolicina: z.string().trim().max(MAX_EXTRA_AMOUNT).optional().default(""),
});

export type ExtraQuery = z.infer<typeof extraQuerySchema>;

const bounded = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) =>
      Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
    );

const boundedNullable = (max: number) =>
  z
    .union([z.coerce.number(), z.null()])
    .nullish()
    .catch(null)
    .transform((n) =>
      typeof n === "number" && Number.isFinite(n)
        ? Math.min(Math.max(n, 0), max)
        : null
    );

export const extraEstimateSchema = z.object({
  /** False when the text isn't food at all ("asdf", "moja mačka"). We refuse
   * rather than invent a calorie count for a typo. */
  prepoznato: z.coerce.boolean().catch(true),
  naziv: z.string().trim().min(1).max(60).catch("Dodatak"),
  /** The natural single unit and its mass -- one tap of "+" adds exactly this. */
  kom_naziv: z.string().trim().max(24).catch(""),
  kom_grami: bounded(2000),
  /** How many of those units the user's amount works out to. */
  kom_broj: bounded(50),
  kcal_100g: bounded(900),
  protein_100g: bounded(100),
  uh_100g: bounded(100),
  mast_100g: bounded(100),
  vlakna_100g: boundedNullable(80),
  secer_100g: boundedNullable(100),
  natrijum_100g_mg: boundedNullable(40000),
  zasicene_100g: boundedNullable(100),
  /** What it assumed, in one short line ("kašika ≈ 15 g"). Shown to the user:
   * an estimate that says out loud what it guessed is one a person can correct. */
  napomena: z.string().trim().max(160).catch("").default(""),
});

export type ExtraEstimate = z.infer<typeof extraEstimateSchema>;

const EXTRA_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    prepoznato: { type: "BOOLEAN" },
    naziv: { type: "STRING" },
    kom_naziv: { type: "STRING" },
    kom_grami: { type: "NUMBER" },
    kom_broj: { type: "NUMBER" },
    kcal_100g: { type: "NUMBER" },
    protein_100g: { type: "NUMBER" },
    uh_100g: { type: "NUMBER" },
    mast_100g: { type: "NUMBER" },
    vlakna_100g: { type: "NUMBER" },
    secer_100g: { type: "NUMBER" },
    natrijum_100g_mg: { type: "NUMBER" },
    zasicene_100g: { type: "NUMBER" },
    napomena: { type: "STRING" },
  },
  required: [
    "prepoznato",
    "naziv",
    "kom_naziv",
    "kom_grami",
    "kom_broj",
    "kcal_100g",
    "protein_100g",
    "uh_100g",
    "mast_100g",
    "vlakna_100g",
    "secer_100g",
    "natrijum_100g_mg",
    "zasicene_100g",
    "napomena",
  ],
  propertyOrdering: [
    "prepoznato",
    "naziv",
    "kom_naziv",
    "kom_grami",
    "kom_broj",
    "kcal_100g",
    "protein_100g",
    "uh_100g",
    "mast_100g",
    "vlakna_100g",
    "secer_100g",
    "natrijum_100g_mg",
    "zasicene_100g",
    "napomena",
  ],
} as const;

export function buildExtraPrompt(query: ExtraQuery): string {
  const amount = query.kolicina.trim();
  return `Ti si nutricionista. Korisnik je uz obrok pojeo JOŠ NEŠTO što nije bilo na slici i sad to opisuje svojim rečima.

Šta je pojeo: "${query.opis}"
Koliko: ${amount ? `"${amount}"` : "(nije rekao — pretpostavi jednu uobičajenu porciju)"}

Vrati nutritivne vrednosti NA 100 g te namirnice, i posebno prirodnu jedinicu kojom se ona meri.

Pravila:
- "prepoznato": true ako je opis hrana ili piće. Ako opis NIJE hrana (besmislen tekst, predmet, osoba), stavi false, "naziv": "Nije hrana" i sve brojeve na 0 — ne izmišljaj.
- "naziv": kratko i konkretno, na srpskom (latinica), veliko početno slovo (npr. "Majonez", "Pita od višanja"). Bez količine u nazivu.
- "kom_naziv": prirodna jedinica u JEDNINI kojom čovek meri baš tu hranu ("kašika", "kašičica", "parče", "komad", "šolja", "šaka", "kriška", "čaša"). Ako ništa ne odgovara, koristi "porcija".
- "kom_grami": masa JEDNOG takvog komada u gramima. Orijentiri: kašika ≈ 15 g, kašičica ≈ 5 g, kriška hleba ≈ 30 g, šolja ≈ 200 g, šaka orašastih ≈ 30 g, parče pite ≈ 150 g.
- "kom_broj": koliko TAKVIH komada je korisnik pojeo, po njegovom opisu količine gore. Ako je rekao u gramima ili mililitrima, pretvori u komade (npr. "30 g majoneza" uz kašiku od 15 g → 2). Ako nije rekao koliko, stavi 1 i uzmi uobičajenu porciju.
- "kcal_100g", "protein_100g", "uh_100g", "mast_100g": vrednosti NA 100 g, po standardnim nutritivnim tabelama za srpsko/balkansko tržište.
- "vlakna_100g": dijetna vlakna u gramima na 100 g (meso, riba, jaja, sir, ulje NEMAJU vlakna; povrće, voće, mahunarke, integralno ih imaju).
- "secer_100g": UKUPNI šećeri u gramima na 100 g, ne veće od ugljenih hidrata.
- "natrijum_100g_mg": natrijum u MILIGRAMIMA na 100 g (NE grami soli). Ako znaš so u gramima: natrijum_mg = grami_soli × 400.
- "zasicene_100g": zasićene masne kiseline u gramima na 100 g, ne veće od ukupne masti.
- "napomena": jedna kratka rečenica šta si pretpostavio (npr. "Kašika majoneza ≈ 15 g."). Bez uvoda.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
}

/**
 * Estimates a written-in extra. Returns `null` on any failure (no key, HTTP
 * error, timeout, unparseable answer) -- the sheet then says so and the user
 * still has the chips and the steppers, exactly as before this existed.
 */
export async function estimateExtraFromText(
  query: ExtraQuery
): Promise<ExtraEstimate | null> {
  const prompt = buildExtraPrompt(query);
  let text = await postJsonPrompt(
    prompt,
    EXTRA_RESPONSE_SCHEMA,
    EXTRA_TIMEOUT_MS,
    EXTRA_MAX_TOKENS
  );

  if (!text) {
    await new Promise((resolve) => setTimeout(resolve, EXTRA_RETRY_DELAY_MS));
    text = await postJsonPrompt(
      prompt,
      EXTRA_RESPONSE_SCHEMA,
      EXTRA_TIMEOUT_MS,
      EXTRA_MAX_TOKENS
    );
  }
  if (!text) return null;

  try {
    const parsed = extraEstimateSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Fallbacks for a model that returned a unit we can't use. "porcija" is the
 * honest word for "one of whatever this is". */
const FALLBACK_UNIT_LABEL = "porcija";
const FALLBACK_UNIT_GRAMS = 100;

/**
 * Turns an estimate into the same shape a catalog chip has, so the sheet and
 * `applyAddMore` cannot tell the two apart.
 *
 * The id is prefixed `ai:` for one reason: the save request resolves catalog
 * ids against `foods` server-side, and an AI extra has no row there. The prefix
 * is what lets the route keep that rule for everything that IS in the catalog
 * (see `POST /api/logs/[id]/dodaj`).
 */
export function toAiExtraFood(
  estimate: ExtraEstimate,
  id: string
): { food: ExtraFood; units: number } {
  const unitLabel = estimate.kom_naziv.trim() || FALLBACK_UNIT_LABEL;
  const unitGrams = estimate.kom_grami > 0 ? estimate.kom_grami : FALLBACK_UNIT_GRAMS;
  // At least one: an estimate the user asked for and that adds nothing would
  // look like the feature silently failed.
  const units = Math.max(Math.round(estimate.kom_broj), 1);

  return {
    food: {
      id,
      name_sr: estimate.naziv,
      kcal_100g: estimate.kcal_100g,
      protein_100g: estimate.protein_100g,
      carbs_100g: estimate.uh_100g,
      fat_100g: estimate.mast_100g,
      fiber_100g: estimate.vlakna_100g,
      sugar_100g: estimate.secer_100g,
      sodium_100g: estimate.natrijum_100g_mg,
      sat_fat_100g: estimate.zasicene_100g,
      unit_label: unitLabel,
      unit_grams: unitGrams,
      emoji: foodEmoji(estimate.naziv),
      label: estimate.naziv,
      // No hand-written genitive for something the user just invented, so the
      // confirmation chip falls back to "2 kašike · Tartar sos" -- plain beats
      // confidently wrong Serbian.
      of: null,
    },
    units,
  };
}
