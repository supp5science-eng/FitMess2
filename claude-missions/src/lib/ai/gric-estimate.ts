import { z } from "zod";

// "Gric" — quick spoken logging of the small stuff (a cucumber, a handful of
// seeds, two apricots) that never gets logged because photographing and
// weighing it costs more than the food is worth. When logging is more
// expensive than the snack, people skip it, the day's total reads falsely low,
// and they stop trusting the number — so the goal here is COVERAGE, not
// precision.
//
// How this differs from "Reci obrok" (`voice-estimate.ts`), which also takes
// audio:
//   - Gric returns MANY items from ONE recording. "pojeo sam krastavac, malo
//     semenki i dve kajsije" is three log rows, not one averaged "meal".
//   - Every item carries a `varijansa` (how much a portion of THIS food can
//     realistically differ). A cucumber is ~15 kcal ± 5; a slice of cake is
//     ~350 ± 250. Same relative error, completely different consequence — so
//     the UI only stops to ask about the high-variance ones and lets the rest
//     save themselves.
//   - No editable macro form. The confirm screen is chips you may tap, not
//     fields you must fill.
//
// This module owns the prompt, the Gemini response schema, the defensive Zod
// parse, and the pure portion-scaling helpers. Deliberately self-contained (no
// micronutrients, no shared prompt fragments) so the flow keeps working while
// the meal-photo modules are being reworked in parallel.

/** Coerced, clamped, non-negative. The model may return a string or nonsense;
 * that must never break a flow whose whole point is being effortless. */
const bounded = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0));

/**
 * How much a real-world portion of this food can vary from the estimate.
 * Drives the ONE interaction Gric ever asks for: low/medium items save
 * themselves, high ones want a single tap on a size chip.
 */
export const VARIANCE_VALUES = ["niska", "srednja", "visoka"] as const;
export type Variance = (typeof VARIANCE_VALUES)[number];

export const gricItemSchema = z.object({
  naziv: z.string().trim().min(1).max(60).catch("Sitnica"),
  // What the user actually said, in their units ("šaka semenki", "2 kajsije").
  // Shown on the chip instead of grams, because "šaka" is the unit people
  // think in and grams are the unit they refuse to measure.
  kolicina: z.string().trim().max(40).catch("").default(""),
  grami: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 1), 2000) : 1)),
  kcal: bounded(4000),
  protein_g: bounded(400),
  uh_g: bounded(700),
  mast_g: bounded(400),
  varijansa: z.enum(VARIANCE_VALUES).catch("srednja"),
});

export type GricItem = z.infer<typeof gricItemSchema>;

export const gricEstimateSchema = z.object({
  // Empty = nothing edible was understood in the clip. The UI says so plainly
  // rather than inventing a "Nejasan unos" row with zeroes in it.
  stavke: z.array(gricItemSchema).max(8).catch([]).default([]),
});

export type GricEstimate = z.infer<typeof gricEstimateSchema>;

// Gemini REST `responseSchema` (OpenAPI subset: uppercase types,
// `propertyOrdering`). `grami` is ordered before the macros so the model
// commits to a portion size first and then derives the numbers from it,
// instead of picking a round calorie count and back-filling the weight.
export const GRIC_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    stavke: {
      type: "ARRAY",
      items: {
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
        required: [
          "naziv",
          "kolicina",
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
          "varijansa",
        ],
        propertyOrdering: [
          "naziv",
          "kolicina",
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
          "varijansa",
        ],
      },
    },
  },
  required: ["stavke"],
  propertyOrdering: ["stavke"],
} as const;

export const GRIC_PROMPT = `U audio snimku korisnik na srpskom govori šta je pojeo ili popio — obično SITNICE koje nije merio ni slikao (krastavac, šaka semenki, par kajsija, keks uz kafu).

Zadatak: razdvoj snimak na POJEDINAČNE stavke i za svaku daj nutritivne vrednosti ZA POJEDENU KOLIČINU (ne na 100 g).

Pravila:
- JEDAN snimak može sadržati VIŠE stavki. "pojeo sam krastavac, malo semenki i dve kajsije" = TRI stavke. Nikad ih ne spajaj u jedan obrok.
- Korisnik može pomenuti i nešto od ranije ("pre toga sam jeo…") — to je i dalje zasebna stavka, uvrsti je.
- "naziv": kratko, na srpskom (latinica), jednina ili množina kako je prirodno (npr. "Krastavac", "Suncokretove semenke", "Kajsije").
- "kolicina": kratak opis količine ONAKO KAKO JE KORISNIK REKAO ili kako je prirodno reći (npr. "1 komad", "šaka", "2 komada", "par kašika"). Bez grama u ovom polju.
- "grami": procenjena jestiva masa te stavke u gramima (tečnost: 1 ml ≈ 1 g). Kućne mere: šaka semenki/koštunjavog ≈ 20–30 g, prstohvat ≈ 5 g, kašika ≈ 15 g, srednji krastavac ≈ 150 g, kajsija ≈ 40 g, jabuka ≈ 180 g, parče kolača ≈ 90 g, kriška hleba ≈ 35 g.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za tu stavku, izvedeno iz "grami".
- "varijansa" — koliko realna porcija TE hrane može da odstupa od procene:
  - "niska": jasno definisana, malo variranje (voće i povrće po komadu, jogurt u pakovanju, jaje, proizvod sa deklaracijom).
  - "srednja": kućna mera bez pakovanja (šaka semenki, par kašika, kriška hleba).
  - "visoka": porcija koja ozbiljno varira i nosi puno kalorija (kolač, torta, pica, burek, sendvič, pljeskavica, „domaći ručak", „nešto iz pekare", hrana u restoranu, alkohol u nepoznatoj meri).
- Ako korisnik NAVEDE tačne vrednosti sa deklaracije, koristi tačno te brojeve i stavi "varijansa": "niska".
- Ako u snimku nema hrane ni pića, ili je nerazumljiv, vrati prazan niz: {"stavke": []}.
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;

/**
 * Portion sizes offered as chips on high-variance items. Multipliers, not
 * grams, so one set of labels works for cake, burek and a sandwich alike.
 * `normalno` is exactly the model's own estimate — tapping it changes nothing,
 * it just confirms.
 */
export const PORTION_SIZES = [
  { id: "malo", label: "Manje", factor: 0.6 },
  { id: "normalno", label: "Normalno", factor: 1 },
  { id: "veliko", label: "Više", factor: 1.6 },
] as const;

export type PortionSizeId = (typeof PORTION_SIZES)[number]["id"];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rescale one item to a portion size. Pure: takes the ORIGINAL item every
 * time, so tapping Manje → Više → Manje never compounds rounding drift.
 */
export function scaleGricItem(item: GricItem, size: PortionSizeId): GricItem {
  const factor = PORTION_SIZES.find((s) => s.id === size)?.factor ?? 1;
  if (factor === 1) return item;
  return {
    ...item,
    grami: Math.max(1, Math.round(item.grami * factor)),
    kcal: Math.round(item.kcal * factor),
    protein_g: round1(item.protein_g * factor),
    uh_g: round1(item.uh_g * factor),
    mast_g: round1(item.mast_g * factor),
  };
}

/**
 * Above this many kcal, a "gric" was actually a meal — the flow still saves it
 * (never make someone redo work they already did), but afterwards offers to
 * replace it with a photo estimate, which is far more accurate at this size.
 */
export const MEAL_SIZED_KCAL = 400;

/**
 * Items whose portion genuinely needs the user's eyes. These suppress the
 * silent auto-save; everything else commits itself.
 */
export function needsConfirmation(items: GricItem[]): boolean {
  return items.some((item) => item.varijansa === "visoka");
}

export function totalKcal(items: GricItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.kcal, 0));
}
