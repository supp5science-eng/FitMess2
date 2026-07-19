import { z } from "zod";

import { CONFIDENCE_VALUES } from "@/lib/ai/meal-estimate";

// MVP (M7 / F063): AI nutrition-label extraction. Gemini reads a photo of a
// product's nutrition declaration and returns PER-100g values + name/brand as
// strict JSON, so we can pre-fill the existing "novi proizvod" form (which
// creates the food + logs a portion). Bounds match `src/lib/food/create.ts`
// (kcal <= 900, macros <= 100 per 100 g) so the prefilled values pass that
// form's validation.

const bounded = (max: number) =>
  z.coerce
    .number()
    .catch(0)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0));

export const labelEstimateSchema = z.object({
  naziv: z.string().trim().max(120).catch("").default(""),
  brend: z.string().trim().max(80).catch("").default(""),
  kcal_100g: bounded(900),
  protein_100g: bounded(100),
  uh_100g: bounded(100),
  mast_100g: bounded(100),
  sigurnost: z.enum(CONFIDENCE_VALUES).catch("srednja"),
  napomena: z.string().trim().max(300).catch("").default(""),
});

export type LabelEstimate = z.infer<typeof labelEstimateSchema>;

export const LABEL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    naziv: { type: "STRING" },
    brend: { type: "STRING" },
    kcal_100g: { type: "NUMBER" },
    protein_100g: { type: "NUMBER" },
    uh_100g: { type: "NUMBER" },
    mast_100g: { type: "NUMBER" },
    sigurnost: { type: "STRING", enum: [...CONFIDENCE_VALUES] },
    napomena: { type: "STRING" },
  },
  required: ["kcal_100g", "protein_100g", "uh_100g", "mast_100g", "sigurnost"],
  propertyOrdering: [
    "naziv",
    "brend",
    "kcal_100g",
    "protein_100g",
    "uh_100g",
    "mast_100g",
    "sigurnost",
    "napomena",
  ],
} as const;

export const LABEL_PROMPT = `Na slici je nutritivna deklaracija (tabela hranljivih vrednosti) prehrambenog proizvoda.
Pročitaj tabelu i vrati vrednosti NA 100 g proizvoda.

Pravila:
- "kcal_100g": energetska vrednost u kcal na 100 g (ako je data u kJ, podeli sa 4.184).
- "protein_100g", "uh_100g" (ugljeni hidrati), "mast_100g": grami na 100 g.
- Ako tabela daje vrednosti po porciji (a ne po 100 g), preračunaj na 100 g koristeći navedenu masu porcije. Ako ne možeš da preračunaš, daj najbolju procenu i snizi "sigurnost".
- "naziv": naziv proizvoda ako se vidi na pakovanju (srpski/latinica), inače ostavi prazno "".
- "brend": brend ako se vidi, inače prazno "".
- "sigurnost": "niska" | "srednja" | "visoka".
- "napomena": kratko (npr. "vrednosti bile po porciji od 30 g").
- Vrati ISKLJUČIVO JSON po zadatoj šemi. Bez teksta van JSON-a. Brojevi bez jedinica.`;
