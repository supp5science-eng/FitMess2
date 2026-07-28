/**
 * "Šta da jedeš danas" (2026-07-28): the curated catalog of HEALTHY meal
 * templates the daily suggestion draws from, plus the pure arithmetic that
 * sums and scales a template's macros.
 *
 * Deliberately a code-level catalog (same shape/spirit as
 * `src/lib/budget/rules.ts`'s `RULE_CATALOG` and
 * `src/lib/home/adaptive.ts`'s constants), NOT a database table: v1 suggests
 * from a fixed, hand-curated set so a user who only ever logs junk is still
 * offered something genuinely healthy (the product owner's call -- never mine
 * suggestions from their own history). Every macro the UI shows is COMPUTED
 * here from per-100 g reference values, never eyeballed -- the same
 * "money-math rule" as the budget engine.
 *
 * Per-100 g values are standard reference figures for the edible form noted on
 * each ingredient (raw meat, dry grains/legumes, etc.); they are reference
 * points for a curated plan, not a barcode-exact catalog. Precision is
 * deliberately modest (whole-ish grams, kcal), matching how the app already
 * rounds everywhere else.
 */

/** kcal + the three macros. The single shape every meal/target passes around. */
export interface MacroVector {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Which part of the day a template suits. Only two, on purpose: the daily plan
 * suggests at most a lighter "doručak"-type meal and a heartier "glavni" one --
 * the third meal is the user's own free choice and is never templated.
 */
export type MealSlot = "dorucak" | "glavni";

/** Dietary flags, so a later preference model can exclude templates. Unused by
 * v1 filtering (no stored prefs yet) but authored now so the data is ready. */
export type DietTag =
  | "vegetarijansko"
  | "riba"
  | "bez-glutena"
  | "bez-laktoze";

/** One component of a meal: a food, how many grams of it, and its per-100 g macros. */
export interface Ingredient {
  nameSr: string;
  grams: number;
  /** Macros per 100 g of the edible form named above. */
  per100: MacroVector;
}

/** A curated healthy meal: an id, a Serbian name, which slot it suits, dietary
 * tags, and its ingredient breakdown (from which macros are computed). */
export interface MealTemplate {
  id: string;
  nameSr: string;
  slot: MealSlot;
  tags: DietTag[];
  ingredients: Ingredient[];
}

/** A template resolved to concrete grams + computed macros -- what a
 * suggestion actually is once picked and (optionally) scaled to a target. */
export interface ScaledMeal {
  templateId: string;
  nameSr: string;
  slot: MealSlot;
  tags: DietTag[];
  /** Ingredient name + the (scaled, rounded) grams to eat. */
  items: { nameSr: string; grams: number }[];
  /** The whole meal's macros at those grams. */
  macros: MacroVector;
}

// ---------------------------------------------------------------------
// Pure macro arithmetic
// ---------------------------------------------------------------------

/** Round a kcal amount to a whole number (money-math rounding rule). */
function roundKcal(value: number): number {
  return Math.round(value);
}

/** Round a gram amount to a whole number for display macros. */
function roundGram(value: number): number {
  return Math.round(value);
}

/** Round an ingredient portion to the nearest 5 g -- suggested portions are
 * never fake-precise ("155 g", not "153 g"). */
function roundPortion(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

/** Macros of a single ingredient at its grams (per-100 g scaled by grams/100). */
export function ingredientMacros(ingredient: Ingredient): MacroVector {
  const factor = ingredient.grams / 100;
  return {
    kcal: ingredient.per100.kcal * factor,
    proteinG: ingredient.per100.proteinG * factor,
    carbsG: ingredient.per100.carbsG * factor,
    fatG: ingredient.per100.fatG * factor,
  };
}

/** Sum a template's ingredient macros into the whole-meal total (unrounded). */
function sumMacros(ingredients: Ingredient[]): MacroVector {
  return ingredients.reduce<MacroVector>(
    (total, ingredient) => {
      const macros = ingredientMacros(ingredient);
      return {
        kcal: total.kcal + macros.kcal,
        proteinG: total.proteinG + macros.proteinG,
        carbsG: total.carbsG + macros.carbsG,
        fatG: total.fatG + macros.fatG,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

/** A template's macros at its authored grams (rounded for display). */
export function templateMacros(template: MealTemplate): MacroVector {
  const raw = sumMacros(template.ingredients);
  return {
    kcal: roundKcal(raw.kcal),
    proteinG: roundGram(raw.proteinG),
    carbsG: roundGram(raw.carbsG),
    fatG: roundGram(raw.fatG),
  };
}

/**
 * The most a template may be scaled up or down when nudged toward a target's
 * kcal. A curated meal is only stretched so far before it stops being the meal
 * that was curated -- beyond this we would rather pick a different template.
 */
export const MIN_SCALE = 0.65;
export const MAX_SCALE = 1.5;

/**
 * Scales a template by a single factor (clamped to [MIN_SCALE, MAX_SCALE]) so
 * its kcal moves toward `targetKcal`, and resolves it to a `ScaledMeal` with
 * per-ingredient grams (rounded to 5 g) and recomputed, rounded macros. A
 * non-positive/absent target leaves the template at factor 1 (its authored size).
 *
 * Macros are recomputed from the SCALED ingredient grams (not the base macros
 * multiplied by the factor), so the numbers always match the grams the user is
 * told to eat -- no drift between "eat 165 g" and the protein shown.
 */
export function scaleMeal(template: MealTemplate, targetKcal?: number): ScaledMeal {
  const base = sumMacros(template.ingredients);
  const rawFactor =
    targetKcal && targetKcal > 0 && base.kcal > 0 ? targetKcal / base.kcal : 1;
  const factor = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawFactor));

  const scaledIngredients: Ingredient[] = template.ingredients.map(
    (ingredient) => ({
      ...ingredient,
      grams: roundPortion(ingredient.grams * factor),
    })
  );

  const macros = sumMacros(scaledIngredients);

  return {
    templateId: template.id,
    nameSr: template.nameSr,
    slot: template.slot,
    tags: template.tags,
    items: scaledIngredients.map(({ nameSr, grams }) => ({ nameSr, grams })),
    macros: {
      kcal: roundKcal(macros.kcal),
      proteinG: roundGram(macros.proteinG),
      carbsG: roundGram(macros.carbsG),
      fatG: roundGram(macros.fatG),
    },
  };
}

// ---------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------

/** Terse per-100 g reference values, so the catalog below reads as portions. */
const P = {
  zob: { kcal: 380, proteinG: 13, carbsG: 60, fatG: 7 },
  grckiJogurt: { kcal: 73, proteinG: 9, carbsG: 4, fatG: 2 },
  borovnice: { kcal: 57, proteinG: 0.7, carbsG: 14, fatG: 0.3 },
  orasi: { kcal: 654, proteinG: 15, carbsG: 14, fatG: 65 },
  jaje: { kcal: 143, proteinG: 13, carbsG: 1, fatG: 10 },
  spanac: { kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 },
  integralniHleb: { kcal: 247, proteinG: 13, carbsG: 41, fatG: 3.4 },
  maslinovoUlje: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
  banana: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 },
  med: { kcal: 304, proteinG: 0.3, carbsG: 82, fatG: 0 },
  feta: { kcal: 264, proteinG: 14, carbsG: 4, fatG: 21 },
  paprika: { kcal: 31, proteinG: 1, carbsG: 6, fatG: 0.3 },
  piletina: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
  pirinac: { kcal: 360, proteinG: 8, carbsG: 76, fatG: 2.9 },
  brokoli: { kcal: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4 },
  losos: { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13 },
  batat: { kcal: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1 },
  cureca: { kcal: 111, proteinG: 24, carbsG: 0, fatG: 1 },
  kinoa: { kcal: 368, proteinG: 14, carbsG: 64, fatG: 6 },
  salata: { kcal: 20, proteinG: 1.5, carbsG: 4, fatG: 0.2 },
  socivo: { kcal: 352, proteinG: 25, carbsG: 63, fatG: 1 },
  povrceMix: { kcal: 40, proteinG: 2, carbsG: 8, fatG: 0.3 },
  tunjevina: { kcal: 116, proteinG: 26, carbsG: 0, fatG: 1 },
  krompir: { kcal: 77, proteinG: 2, carbsG: 17, fatG: 0.1 },
  grasak: { kcal: 81, proteinG: 5, carbsG: 14, fatG: 0.4 },
  junetina: { kcal: 140, proteinG: 21, carbsG: 0, fatG: 6 },
  tofu: { kcal: 144, proteinG: 15, carbsG: 3, fatG: 8 },
  cureciMleveni: { kcal: 148, proteinG: 21, carbsG: 0, fatG: 7 },
  paradajzSos: { kcal: 32, proteinG: 1.6, carbsG: 7, fatG: 0.3 },
  integralnaTestenina: { kcal: 348, proteinG: 13, carbsG: 71, fatG: 2.5 },
} as const;

/**
 * The curated healthy-meal catalog. Every entry is protein-forward and built
 * from whole foods; the daily plan scores and scales these to the day's
 * remaining macros. Order is not significant (scoring, not priority, picks).
 */
export const HEALTHY_MEALS: MealTemplate[] = [
  // ---- doručak-type (lighter, still protein-forward) ----
  {
    id: "ovsena-jogurt-borovnice",
    nameSr: "Ovsena kaša sa grčkim jogurtom i borovnicama",
    slot: "dorucak",
    tags: ["vegetarijansko"],
    ingredients: [
      { nameSr: "Ovsene pahuljice", grams: 50, per100: P.zob },
      { nameSr: "Grčki jogurt", grams: 150, per100: P.grckiJogurt },
      { nameSr: "Borovnice", grams: 60, per100: P.borovnice },
      { nameSr: "Orasi", grams: 10, per100: P.orasi },
    ],
  },
  {
    id: "kajgana-spanac-tost",
    nameSr: "Kajgana od jaja sa spanaćem i integralnim tostom",
    slot: "dorucak",
    tags: ["vegetarijansko"],
    ingredients: [
      { nameSr: "Jaja", grams: 150, per100: P.jaje },
      { nameSr: "Spanać", grams: 60, per100: P.spanac },
      { nameSr: "Integralni tost", grams: 60, per100: P.integralniHleb },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "jogurt-banana-orasi",
    nameSr: "Grčki jogurt sa bananom, orasima i medom",
    slot: "dorucak",
    tags: ["vegetarijansko", "bez-glutena"],
    ingredients: [
      { nameSr: "Grčki jogurt", grams: 200, per100: P.grckiJogurt },
      { nameSr: "Banana", grams: 100, per100: P.banana },
      { nameSr: "Orasi", grams: 15, per100: P.orasi },
      { nameSr: "Med", grams: 10, per100: P.med },
    ],
  },
  {
    id: "omlet-feta-hleb",
    nameSr: "Omlet sa povrćem i feta sirom uz integralni hleb",
    slot: "dorucak",
    tags: ["vegetarijansko"],
    ingredients: [
      { nameSr: "Jaja", grams: 150, per100: P.jaje },
      { nameSr: "Feta sir", grams: 40, per100: P.feta },
      { nameSr: "Paprika i paradajz", grams: 80, per100: P.paprika },
      { nameSr: "Integralni hleb", grams: 40, per100: P.integralniHleb },
    ],
  },

  // ---- glavni obrok (heartier) ----
  {
    id: "piletina-pirinac-brokoli",
    nameSr: "Pileća prsa, integralni pirinač i brokoli",
    slot: "glavni",
    tags: ["bez-laktoze"],
    ingredients: [
      { nameSr: "Pileća prsa", grams: 150, per100: P.piletina },
      { nameSr: "Integralni pirinač (suvo)", grams: 60, per100: P.pirinac },
      { nameSr: "Brokoli", grams: 150, per100: P.brokoli },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "losos-batat-spanac",
    nameSr: "Losos, batat i spanać",
    slot: "glavni",
    tags: ["riba", "bez-glutena", "bez-laktoze"],
    ingredients: [
      { nameSr: "Losos", grams: 140, per100: P.losos },
      { nameSr: "Batat", grams: 200, per100: P.batat },
      { nameSr: "Spanać", grams: 100, per100: P.spanac },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "cureca-kinoa-salata",
    nameSr: "Ćureća prsa, kinoa i salata",
    slot: "glavni",
    tags: ["bez-glutena", "bez-laktoze"],
    ingredients: [
      { nameSr: "Ćureća prsa", grams: 150, per100: P.cureca },
      { nameSr: "Kinoa (suvo)", grams: 60, per100: P.kinoa },
      { nameSr: "Mešana salata", grams: 150, per100: P.salata },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "socivo-varivo-hleb",
    nameSr: "Sočivo varivo sa povrćem i integralnim hlebom",
    slot: "glavni",
    tags: ["vegetarijansko"],
    ingredients: [
      { nameSr: "Sočivo (suvo)", grams: 80, per100: P.socivo },
      { nameSr: "Šargarepa, luk i paradajz", grams: 150, per100: P.povrceMix },
      { nameSr: "Integralni hleb", grams: 40, per100: P.integralniHleb },
      { nameSr: "Maslinovo ulje", grams: 8, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "tunjevina-krompir-grasak",
    nameSr: "Tunjevina, krompir, grašak i salata",
    slot: "glavni",
    tags: ["riba", "bez-glutena", "bez-laktoze"],
    ingredients: [
      { nameSr: "Tunjevina (u vodi)", grams: 120, per100: P.tunjevina },
      { nameSr: "Krompir", grams: 200, per100: P.krompir },
      { nameSr: "Grašak", grams: 80, per100: P.grasak },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "junetina-pirinac-povrce",
    nameSr: "Nemasna junetina, pirinač i grilovano povrće",
    slot: "glavni",
    tags: ["bez-laktoze", "bez-glutena"],
    ingredients: [
      { nameSr: "Nemasna junetina", grams: 130, per100: P.junetina },
      { nameSr: "Integralni pirinač (suvo)", grams: 55, per100: P.pirinac },
      { nameSr: "Grilovano povrće", grams: 150, per100: P.povrceMix },
      { nameSr: "Maslinovo ulje", grams: 3, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "tofu-kinoa-povrce",
    nameSr: "Tofu sa povrćem i kinoom",
    slot: "glavni",
    tags: ["vegetarijansko", "bez-laktoze"],
    ingredients: [
      { nameSr: "Tofu", grams: 150, per100: P.tofu },
      { nameSr: "Kinoa (suvo)", grams: 50, per100: P.kinoa },
      { nameSr: "Povrće za vok", grams: 150, per100: P.povrceMix },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
  {
    id: "curece-cufte-testenina",
    nameSr: "Ćufte od ćuretine u paradajz sosu sa integralnom testeninom",
    slot: "glavni",
    tags: ["bez-laktoze"],
    ingredients: [
      { nameSr: "Mleveno ćureće meso", grams: 130, per100: P.cureciMleveni },
      { nameSr: "Paradajz sos", grams: 120, per100: P.paradajzSos },
      { nameSr: "Integralna testenina (suvo)", grams: 60, per100: P.integralnaTestenina },
      { nameSr: "Maslinovo ulje", grams: 5, per100: P.maslinovoUlje },
    ],
  },
];

/** Templates suited to a given slot. */
export function mealsForSlot(slot: MealSlot): MealTemplate[] {
  return HEALTHY_MEALS.filter((meal) => meal.slot === slot);
}

/** Normalise a meal name for matching (trim + lowercase). */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

const TEMPLATE_BY_NAME = new Map(
  HEALTHY_MEALS.map((meal) => [normalizeName(meal.nameSr), meal] as const)
);

/**
 * The slot a logged meal belongs to, if its name matches a curated template --
 * how the plan knows a suggested meal was actually logged (the /predlog "Dodaj
 * u dnevnik" writes the template's `nameSr` verbatim). Returns null for any
 * other food, so ordinary logging is unaffected.
 */
export function slotForLoggedName(name: string): MealSlot | null {
  return TEMPLATE_BY_NAME.get(normalizeName(name))?.slot ?? null;
}
