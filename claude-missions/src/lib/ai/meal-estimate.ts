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

/**
 * Same clamp, but "the model didn't say" stays `null` instead of collapsing to
 * `0` -- used for the micronutrients (2026-07-25). For kcal/macros a missing
 * value is a broken response, so `0` is a fine fallback; for fiber/sugar/sodium
 * "unknown" and "none" are genuinely different claims, and writing a confident
 * `0 g` into `logs` would make the home screen's "preostalo" cards wrong (see
 * `supabase/migrations/0017_micronutrients.sql` and `src/lib/nutrition/micro.ts`).
 */
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
  // Micronutrients for the depicted portion (2026-07-25), feeding the home
  // tab's second page. Nullable: an older/unsure response simply leaves them
  // unknown rather than claiming zero.
  vlakna_g: boundedNullable(200),
  secer_g: boundedNullable(800),
  natrijum_mg: boundedNullable(20000),
  zasicene_g: boundedNullable(300),
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
    vlakna_g: { type: "NUMBER" },
    secer_g: { type: "NUMBER" },
    natrijum_mg: { type: "NUMBER" },
    zasicene_g: { type: "NUMBER" },
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
    "vlakna_g",
    "secer_g",
    "natrijum_mg",
    "zasicene_g",
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
    "vlakna_g",
    "secer_g",
    "natrijum_mg",
    "zasicene_g",
    "sigurnost",
    "napomena",
  ],
} as const;

/**
 * Rescales an estimate's micronutrients to the portion the user finally
 * confirmed. The confirm screens let the user correct the grams, and the macros
 * are already recomputed from the AI's per-100g ratio when they do -- this keeps
 * the four micros on that same ratio, so "AI said 700 g, I actually ate 350 g"
 * halves the sodium too instead of logging the full plate's salt.
 *
 * Unknown (`null`) stays unknown at any portion size. Shared by all three
 * confirm flows (photo / voice / photo+description) so they can't drift apart.
 */
export function scaleMealMicros(
  estimate: Pick<
    MealEstimate,
    "procenjeni_grami" | "vlakna_g" | "secer_g" | "natrijum_mg" | "zasicene_g"
  >,
  grams: number
): {
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  satFat: number | null;
} {
  const base = estimate.procenjeni_grami;
  const scale =
    Number.isFinite(base) && base > 0 && Number.isFinite(grams) && grams > 0
      ? grams / base
      : 1;
  const scaled = (value: number | null) =>
    value === null ? null : Math.round(value * scale * 10) / 10;
  return {
    fiber: scaled(estimate.vlakna_g),
    sugar: scaled(estimate.secer_g),
    sodium: scaled(estimate.natrijum_mg),
    satFat: scaled(estimate.zasicene_g),
  };
}

/**
 * The four micronutrient rules, shared verbatim by every prompt that fills the
 * meal schema (photo, photo+voice, label+voice, voice) so the model is told the
 * same thing everywhere -- most importantly that sodium is milligrams, not grams
 * of salt, which is the single easiest unit for it to get wrong (a 40x error).
 * The domain hints ("meso i ulje ne nose vlakna", "industrijska hrana je
 * slanija") are there because they measurably steer a Flash model away from
 * lazily proportional guesses.
 */
export const MICRO_PROMPT_RULES = `- "vlakna_g", "secer_g", "natrijum_mg", "zasicene_g": takođe UKUPNO za tu porciju:
  - "vlakna_g": dijetna vlakna u gramima (povrće, voće, integralne žitarice, mahunarke nose vlakna; meso, jaja, sir i ulje NE nose).
  - "secer_g": UKUPNI šećeri u gramima (i prirodni iz voća/mleka i dodati iz slatkiša/soseva).
  - "natrijum_mg": natrijum u MILIGRAMIMA (ne so u gramima). Ako računaš preko soli: natrijum_mg = grami_soli × 400. Industrijska hrana, sirevi, suhomesnato, pekarski proizvodi i restoranska hrana su znatno slaniji od kuvanog kod kuće.
  - "zasicene_g": zasićene masne kiseline u gramima (deo ukupne masti — mora biti manje od "mast_g"; masti životinjskog porekla, mlečni proizvodi, palmino i kokosovo ulje ih nose najviše).`;

export const MEAL_PROMPT = `Ti si iskusan nutricionista koji procenjuje obroke sa fotografija.
Na slici je hrana/obrok. Proceni nutritivne vrednosti ZA KOLIČINU KOJA SE VIDI na slici (ne za 100 g).

Pravila:
- Naziv na srpskom (latinica), kratko i konkretno (npr. "Ćevapi sa lepinjom i lukom").
- "sastojci": glavne komponente koje prepoznaješ (npr. ["ćevapi", "lepinja", "crni luk"]).
- "procenjeni_grami": ukupna jestiva masa porcije koja se vidi, u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za tu porciju (ne na 100 g).
${MICRO_PROMPT_RULES}
- Koristi realne balkanske porcije. Ako nisi siguran, daj najbolju procenu i snizi "sigurnost".
- "sigurnost": "niska" | "srednja" | "visoka".
- "napomena": kratko objasni pretpostavke (npr. "pretpostavljene 2 kašike ulja").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
