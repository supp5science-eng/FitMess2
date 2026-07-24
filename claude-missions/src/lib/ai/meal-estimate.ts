import { z } from "zod";

// MVP (M7 / F064): AI meal-photo estimate. Gemini looks at a photo of a plate
// and returns a nutrition estimate FOR THE DEPICTED PORTION, as strict JSON.
// Kept provider-agnostic: this file owns the prompt, the JSON response schema
// we ask Gemini to fill, and the Zod schema that defensively validates
// whatever comes back (clamped to sane bounds, `.catch` fallbacks so a stray
// value never crashes the flow).

/** A coerced, clamped non-negative number (AI may return a string or a wild
 * value; never let that break the flow). */
const bounded = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0));

export const CONFIDENCE_VALUES = ["niska", "srednja", "visoka"] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

/**
 * One line of the meal's breakdown ("piletina — 140 g, 230 kcal"). Asking the
 * model to itemise BEFORE it states a total is the single biggest accuracy win
 * in this file: estimating a whole plate in one leap invites a round number,
 * while "chicken + rice + a spoon of oil" forces it to actually add up. The
 * `propertyOrdering` in the response schema keeps components generated first,
 * so the totals are written with the itemisation already in the context.
 *
 * It is also what the user sees on the result screen -- the breakdown is the
 * difference between "the AI said 720" and "here is where 720 comes from",
 * and it is what lets them strike a line they did not actually eat.
 */
export const mealComponentSchema = z.object({
  naziv: z.string().trim().min(1).max(60).catch("Sastojak"),
  grami: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 3000) : 0)),
  kcal: bounded(4000),
  protein_g: bounded(400),
  uh_g: bounded(700),
  mast_g: bounded(400),
});

export type MealComponent = z.infer<typeof mealComponentSchema>;

export const mealEstimateSchema = z.object({
  naziv: z.string().trim().min(1).max(120).catch("Obrok sa slike"),
  sastojci: z.array(z.string().trim().min(1).max(60)).catch([]).default([]),
  // Itemised breakdown. Optional so the older flows (label scan, voice) that
  // never ask for it keep parsing unchanged.
  komponente: z.array(mealComponentSchema).max(12).catch([]).default([]),
  // Estimated total edible weight of the depicted portion, grams.
  procenjeni_grami: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 1), 4000) : 1)),
  kcal: bounded(6000),
  protein_g: bounded(500),
  uh_g: bounded(800),
  mast_g: bounded(500),
  sigurnost: z.enum(CONFIDENCE_VALUES).catch("srednja"),
  napomena: z.string().trim().max(300).catch("").default(""),
});

export type MealEstimate = z.infer<typeof mealEstimateSchema>;

// The JSON schema we constrain Gemini's output to (OpenAPI subset the Gemini
// REST `responseSchema` accepts -- uppercase type names, `propertyOrdering`).
export const MEAL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    naziv: { type: "STRING" },
    sastojci: { type: "ARRAY", items: { type: "STRING" } },
    procenjeni_grami: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    uh_g: { type: "NUMBER" },
    mast_g: { type: "NUMBER" },
    sigurnost: { type: "STRING", enum: [...CONFIDENCE_VALUES] },
    napomena: { type: "STRING" },
  },
  required: [
    "naziv",
    "procenjeni_grami",
    "kcal",
    "protein_g",
    "uh_g",
    "mast_g",
    "sigurnost",
  ],
  propertyOrdering: [
    "naziv",
    "sastojci",
    "procenjeni_grami",
    "kcal",
    "protein_g",
    "uh_g",
    "mast_g",
    "sigurnost",
    "napomena",
  ],
} as const;

export const MEAL_PROMPT = `Ti si iskusan nutricionista koji procenjuje obroke sa fotografija.
Na slici je hrana/obrok. Proceni nutritivne vrednosti ZA KOLIČINU KOJA SE VIDI na slici (ne za 100 g).

Pravila:
- Naziv na srpskom (latinica), kratko i konkretno (npr. "Ćevapi sa lepinjom i lukom").
- "sastojci": glavne komponente koje prepoznaješ (npr. ["ćevapi", "lepinja", "crni luk"]).
- "procenjeni_grami": ukupna jestiva masa porcije koja se vidi, u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za tu porciju (ne na 100 g).
- Koristi realne balkanske porcije. Ako nisi siguran, daj najbolju procenu i snizi "sigurnost".
- "sigurnost": "niska" | "srednja" | "visoka".
- "napomena": kratko objasni pretpostavke (npr. "pretpostavljene 2 kašike ulja").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
