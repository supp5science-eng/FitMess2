import { z } from "zod";

import { postJsonPrompt } from "@/lib/ai/micro-estimate";
import type { LogComponentSnapshot } from "@/lib/types/db";

/**
 * Meal SPLIT (2026-07-25): break an ALREADY LOGGED entry into the individual
 * foods it was made of, from nothing but its name and its stored totals.
 *
 * ## Why this exists
 *
 * "Dodaj još" only earns its keep when it can offer "+1 jaje" and "+1 kašika
 * pavlake" separately -- an entry you can only double is barely better than
 * logging it twice. The photo estimator now returns that breakdown at capture
 * time, but that fixes nothing for what is ALREADY in the database, which is
 * everything the user has logged so far, plus everything that keeps arriving
 * through paths that have no breakdown: catalog/barcode entries, "Gric", voice.
 *
 * So the breakdown is derived on demand instead: "Kajgana od 6 jaja sa kiselom
 * pavlakom, 360 g, 625 kcal" is enough for a model to answer "6 eggs of ~50 g
 * and 2 spoons of sour cream of ~30 g", which is exactly the itemisation the
 * steppers need. It runs once per entry -- the result is written back to
 * `logs.components` (0019) -- so the cost is a single cheap text call, paid the
 * first time the user taps "Dodaj još" on that meal.
 *
 * ## The totals are sacred
 *
 * The user already reviewed and accepted this entry's kcal. A split must
 * therefore never CHANGE what the day counts -- so whatever the model returns
 * is normalised (`normalizeSplit`) to sum back to exactly the stored totals.
 * The model's job here is only the RATIO between the parts and the size of one
 * natural unit, never the size of the meal.
 */

const SPLIT_TIMEOUT_MS = 12_000;
const SPLIT_MAX_TOKENS = 2_000;
const SPLIT_RETRY_DELAY_MS = 2_000;

/** More lines than this stops being a breakdown and starts being a recipe. */
const MAX_PARTS = 8;

export interface SplitMealQuery {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const partSchema = z.object({
  naziv: z.string().trim().min(1).max(60),
  kom_naziv: z.string().trim().max(24).catch(""),
  kom_grami: z.coerce.number().min(0).max(3000).catch(0),
  kom_broj: z.coerce.number().min(0).max(200).catch(0),
  grami: z.coerce.number().min(0).max(5000).catch(0),
  kcal: z.coerce.number().min(0).max(6000).catch(0),
  protein_g: z.coerce.number().min(0).max(800).catch(0),
  uh_g: z.coerce.number().min(0).max(800).catch(0),
  mast_g: z.coerce.number().min(0).max(800).catch(0),
});

const splitSchema = z.object({
  komponente: z.array(partSchema).min(1).max(MAX_PARTS),
});

const SPLIT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    komponente: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          naziv: { type: "STRING" },
          kom_naziv: { type: "STRING" },
          kom_grami: { type: "NUMBER" },
          kom_broj: { type: "NUMBER" },
          grami: { type: "NUMBER" },
          kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          uh_g: { type: "NUMBER" },
          mast_g: { type: "NUMBER" },
        },
        required: [
          "naziv",
          "kom_naziv",
          "kom_grami",
          "kom_broj",
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
        ],
        propertyOrdering: [
          "naziv",
          "kom_naziv",
          "kom_grami",
          "kom_broj",
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
        ],
      },
    },
  },
  required: ["komponente"],
} as const;

function buildPrompt(meal: SplitMealQuery): string {
  return `Ti si nutricionista. Dole je JEDAN već zabeležen obrok sa svojim ukupnim vrednostima.
Razloži ga na POJEDINAČNE NAMIRNICE od kojih se sastoji.

Obrok: "${meal.name}"
Ukupno: ${Math.round(meal.grams)} g, ${Math.round(meal.kcal)} kcal, proteini ${meal.protein} g, ugljeni hidrati ${meal.carbs} g, masti ${meal.fat} g.

Pravila:
- Jedna stavka = JEDNA vrsta hrane koju čovek može da uzme zasebno (jaja, pavlaka, hleb, ulje, piletina, pirinač...). Nikad ne spajaj dve takve namirnice u jednu stavku.
- NE razlaži gotov proizvod na sirovine iz sastava. Napolitanka NIJE "šećer + biljna mast + brašno + kakao" — to su sastojci iz fabrike, niko ne može da pojede "još jednu kašiku palmine masti". Napolitanka je JEDNA stavka sa jedinicom "komad". Isto važi za keks, čokoladicu, jogurt, pecivo, sok.
- Ako je obrok jedna jedina namirnica, vrati TAČNO JEDNU stavku — sa njenom prirodnom jedinicom.
- Ako naziv obroka kaže količinu ("od 6 jaja", "2 kašike"), ISPOŠTUJ je.
- "kom_naziv" = prirodna jedinica te namirnice u jednini ("jaje", "kašika", "kriška", "komad", "šolja"). "kom_grami" = masa JEDNOG takvog komada. "kom_broj" = koliko ih ima u ovom obroku.
  - Realne mase: jaje ≈ 50 g, kašika pavlake/ulja/pirinča ≈ 15–25 g, kriška hleba ≈ 30 g.
- Ako namirnica nema prirodnu jedinicu (npr. sos, začin), stavi "kom_naziv": "" i "kom_grami": 0, a "kom_broj": 0.
- "grami", "kcal", "protein_g", "uh_g", "mast_g" su vrednosti za CELU tu stavku u ovom obroku.
- Zbir svih stavki mora da odgovara ukupnim vrednostima obroka gore. Ne menjaj veličinu obroka.
- 1–${MAX_PARTS} stavki. Nazivi na srpskom (latinica).

Primeri:
- "Kajgana od 6 jaja sa kiselom pavlakom" → 2 stavke: jaja (6 × jaje, 50 g) i kisela pavlaka (2 × kašika, 20 g).
- "Napolitanka sa čokoladnim filom" → 1 stavka: napolitanka (1 × komad).
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Brojevi bez jedinica.`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Forces the parts to add back up to the entry the user already accepted.
 *
 * Each nutrient gets its own factor (the model's kcal split can be good while
 * its protein split is sloppy, and each must still total correctly). `kom_grami`
 * rides the SAME factor as `grami`, so the piece count implied by the split --
 * six eggs, not six-and-a-bit -- survives the correction.
 *
 * A nutrient the model zeroed out entirely can't be rescaled into existence, so
 * it is spread across the parts by their mass instead; that keeps the totals
 * exact rather than quietly losing grams of protein.
 */
export function normalizeSplit(
  parts: z.infer<typeof partSchema>[],
  meal: SplitMealQuery
): LogComponentSnapshot[] {
  const sum = (pick: (p: z.infer<typeof partSchema>) => number) =>
    parts.reduce((total, part) => total + Math.max(pick(part), 0), 0);

  const gramsSum = sum((p) => p.grami);
  const massShare = (part: z.infer<typeof partSchema>) =>
    gramsSum > 0 ? Math.max(part.grami, 0) / gramsSum : 1 / parts.length;

  const scaleFor = (partSum: number, target: number) =>
    partSum > 0 ? target / partSum : 0;

  const kcalScale = scaleFor(sum((p) => p.kcal), meal.kcal);
  const proteinScale = scaleFor(sum((p) => p.protein_g), meal.protein);
  const carbsScale = scaleFor(sum((p) => p.uh_g), meal.carbs);
  const fatScale = scaleFor(sum((p) => p.mast_g), meal.fat);
  const gramsScale = scaleFor(gramsSum, meal.grams);

  return parts.map((part) => {
    const share = massShare(part);
    const value = (raw: number, scale: number, target: number) =>
      scale > 0 ? raw * scale : target * share;

    return {
      naziv: part.naziv,
      grami: round1(value(part.grami, gramsScale, meal.grams)),
      kcal: Math.round(value(part.kcal, kcalScale, meal.kcal)),
      protein_g: round1(value(part.protein_g, proteinScale, meal.protein)),
      uh_g: round1(value(part.uh_g, carbsScale, meal.carbs)),
      mast_g: round1(value(part.mast_g, fatScale, meal.fat)),
      kom_naziv: part.kom_naziv,
      // Same factor as `grami`: the number of pieces must not drift when the
      // split is corrected back onto the stored totals.
      kom_grami:
        gramsScale > 0 ? round1(part.kom_grami * gramsScale) : round1(part.kom_grami),
    };
  });
}

/**
 * Splits a logged meal into its foods. Returns `null` on any failure (no key,
 * HTTP error, timeout, unparseable answer, single-item answer that adds
 * nothing) -- the caller then simply keeps offering whole-entry seconds, which
 * is the behaviour that existed before this module.
 */
export async function splitLoggedMeal(
  meal: SplitMealQuery
): Promise<LogComponentSnapshot[] | null> {
  const prompt = buildPrompt(meal);
  let text = await postJsonPrompt(
    prompt,
    SPLIT_RESPONSE_SCHEMA,
    SPLIT_TIMEOUT_MS,
    SPLIT_MAX_TOKENS
  );

  // One quick retry. The failure this actually catches is the per-minute quota
  // (429), which clears in seconds -- and the user is sitting behind a spinner,
  // so the batch path's 30 s backoff is useless here. Two attempts is the most
  // a person will wait before the fallback ("dodaj ceo unos") is the kinder
  // answer.
  if (!text) {
    await new Promise((resolve) => setTimeout(resolve, SPLIT_RETRY_DELAY_MS));
    text = await postJsonPrompt(
      prompt,
      SPLIT_RESPONSE_SCHEMA,
      SPLIT_TIMEOUT_MS,
      SPLIT_MAX_TOKENS
    );
  }
  if (!text) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    console.warn("[split-meal] unparseable response");
    return null;
  }

  const parsed = splitSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[split-meal] response failed validation");
    return null;
  }

  const parts = parsed.data.komponente.filter((part) => part.grami > 0);
  if (parts.length === 0) return null;

  return normalizeSplit(parts, meal);
}
