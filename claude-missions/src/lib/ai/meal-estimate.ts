import { z } from "zod";

import {
  HIDDEN_FAT_RULES,
  NUTRITION_ANCHORS,
} from "@/lib/ai/nutrition-anchors";

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
  /**
   * The NATURAL SINGLE UNIT of this component and its mass -- "jaje" / 60,
   * "kašika" / 15, "kriška" / 30. Optional, and `0`/"" means "no natural unit,
   * treat the whole line as one".
   *
   * This exists for "Dodaj još" (2026-07-25): a breakdown line reads "jaja,
   * 120 g", so without a per-unit mass one tap of "+" would silently add TWO
   * eggs. With it, the stepper adds exactly one egg, one spoon, one slice --
   * which is how people actually describe seconds. See
   * `src/lib/log/add-more.ts`.
   */
  // Optional in the OUTPUT type as well, not just the input: the older flows
  // (Prizma, voice) fill `komponente` from their own schemas, which know
  // nothing about natural units, and every reader already treats "absent" as
  // "no natural unit" (`componentUnitFraction`).
  kom_naziv: z.string().trim().max(24).catch("").optional(),
  kom_grami: z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 3000) : 0))
    .optional(),
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
  // Set by the photo flow when the image has no food/drink at all (a selfie, a
  // meme, an empty table, a screenshot). Optional + default false, so every
  // other flow that fills this schema (voice, combined, Prizma finalize) is
  // unaffected -- only "Slikaj obrok" asks for it (via MEAL_PHOTO_RESPONSE_SCHEMA
  // below) and only its action reads it.
  //
  // Strict boolean (NOT `z.coerce`): only a real `true` blocks the flow;
  // anything odd falls back to false. A false negative (missing a no-food photo)
  // just estimates as before, but a false positive would wrongly refuse a real
  // meal -- so the safe default is "there is food".
  nema_hrane: z.boolean().catch(false).default(false),
});

export type MealEstimate = z.infer<typeof mealEstimateSchema>;

// The JSON schema we constrain Gemini's output to (OpenAPI subset the Gemini
// REST `responseSchema` accepts -- uppercase type names, `propertyOrdering`).
export const MEAL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    naziv: { type: "STRING" },
    sastojci: { type: "ARRAY", items: { type: "STRING" } },
    // 2026-07-25: the photo flow now asks for the itemised breakdown too (it
    // was Prizma-only before). Two reasons, in order of importance: it is what
    // "Dodaj još" stores on the log row so the user can add two more eggs to a
    // photographed plate without re-shooting it (0019_log_components.sql), and
    // -- per this file's `mealComponentSchema` header -- itemising BEFORE
    // totalling is itself the biggest accuracy win available here.
    komponente: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          naziv: { type: "STRING" },
          kom_naziv: { type: "STRING" },
          kom_grami: { type: "NUMBER" },
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
          "grami",
          "kcal",
          "protein_g",
          "uh_g",
          "mast_g",
        ],
      },
    },
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
    "komponente",
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
    // Generated BEFORE the totals on purpose: the model writes the totals with
    // its own itemisation already in context, so it adds up instead of guessing
    // a round number for the whole plate.
    "komponente",
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

// The "Slikaj obrok" photo flow gets its OWN response schema. The shared
// MEAL_RESPONSE_SCHEMA above stays byte-for-byte identical -- the voice and
// combined flows re-use it, and neither should be asked to judge "is there
// food" (voice has no image at all). This one adds a `nema_hrane` gate the model
// answers FIRST (propertyOrdering), so a photo with no food is caught before any
// number is invented and the flow can say so plainly instead of hallucinating a
// meal for a selfie or a meme.
export const MEAL_PHOTO_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nema_hrane: { type: "BOOLEAN" },
    ...MEAL_RESPONSE_SCHEMA.properties,
  },
  required: ["nema_hrane", ...MEAL_RESPONSE_SCHEMA.required],
  propertyOrdering: ["nema_hrane", ...MEAL_RESPONSE_SCHEMA.propertyOrdering],
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
 * Rescales the itemised breakdown to the portion the user finally confirmed --
 * the same "AI said 700 g, I actually ate 350 g" correction `scaleMealMicros`
 * applies to the micros, so the stored breakdown stays consistent with the
 * stored totals (0019). Without this, "Dodaj još" would offer "+1 jaje" priced
 * off a plate the user already told us was twice too big.
 *
 * `kom_grami` is deliberately NOT scaled: one egg weighs 60 g regardless of how
 * many were on the plate.
 */
export function scaleMealComponents(
  estimate: Pick<MealEstimate, "procenjeni_grami" | "komponente">,
  grams: number
): MealComponent[] {
  const base = estimate.procenjeni_grami;
  const scale =
    Number.isFinite(base) && base > 0 && Number.isFinite(grams) && grams > 0
      ? grams / base
      : 1;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return estimate.komponente.map((component) => ({
    ...component,
    grami: round1(component.grami * scale),
    kcal: Math.round(component.kcal * scale),
    protein_g: round1(component.protein_g * scale),
    uh_g: round1(component.uh_g * scale),
    mast_g: round1(component.mast_g * scale),
  }));
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

PRVO PROVERI IMA LI HRANE NA SLICI. Ako na slici NEMA nikakve hrane ni pića (npr. selfi, meme, prazan tanjir, nasumičan predmet, ekran, dokument, životinja), postavi "nema_hrane": true, "naziv": "Nema hrane", a sve brojeve (procenjeni_grami, kcal, makroe, mikroe) na 0 — i tu stani, ne izmišljaj obrok. Ako hrane IMA, postavi "nema_hrane": false i normalno proceni.

Kad ima hrane, proceni nutritivne vrednosti ZA KOLIČINU KOJA SE VIDI na slici (ne za 100 g).

Pravila:
- Naziv na srpskom (latinica), kratko i konkretno (npr. "Ćevapi sa lepinjom i lukom").
- "sastojci": glavne komponente koje prepoznaješ (npr. ["ćevapi", "lepinja", "crni luk"]).
- "komponente": PRVO razbij obrok na delove (2–8 stavki), svaka sa "naziv", "grami", "kcal", "protein_g", "uh_g", "mast_g" za tu stavku (vrednosti za CELU tu stavku na slici). Svaka stavka mora biti nešto što se može zasebno dodati (npr. jaja, pavlaka, hleb — ne "začini").
  - "kom_naziv" i "kom_grami": prirodna JEDINICA te stavke i masa JEDNOG komada — npr. jaja → "jaje" i 60, pavlaka → "kašika" i 15, hleb → "kriška" i 30, pirinač → "kašika" i 25. Ako stavka nema prirodnu jedinicu (npr. sos, ulje), stavi "" i 0.
  - Tek onda saberi komponente u ukupne vrednosti; ukupno treba da bude zbir komponenti.
- "procenjeni_grami": ukupna jestiva masa porcije koja se vidi, u gramima.
- "kcal", "protein_g", "uh_g", "mast_g": UKUPNO za tu porciju (ne na 100 g).
${MICRO_PROMPT_RULES}
- Koristi realne balkanske porcije. Ako nisi siguran, daj najbolju procenu i snizi "sigurnost".
- "sigurnost": "niska" | "srednja" | "visoka".
- "napomena": kratko objasni pretpostavke (npr. "pretpostavljene 2 kašike ulja jer deluje prženo").

${HIDDEN_FAT_RULES}

${NUTRITION_ANCHORS}

- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
