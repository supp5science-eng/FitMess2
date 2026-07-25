/**
 * Micronutrients (2026-07-25): fiber, total sugar, sodium and saturated fat --
 * the four numbers the home tab's second page shows next to the calorie ring,
 * plus the daily targets they are measured against.
 *
 * Same "money-math rule" posture as `src/lib/budget/engine.ts`,
 * `src/lib/food/portions.ts` and `src/lib/home/totals.ts`: every number the user
 * sees is computed by deterministic, DB-free, unit-tested code here -- a
 * component never multiplies or guesses.
 *
 * Two ideas run through the whole file:
 *
 * 1. **`null` means UNKNOWN, never zero.** A logged plate whose fiber nobody
 *    ever estimated must not contribute a confident "0 g" to the day. Every sum
 *    therefore carries the kcal it was computed FROM (`coveredKcal`), so the UI
 *    can say "za neke unose nemamo podatke" instead of quietly lying. See
 *    `supabase/migrations/0017_micronutrients.sql`.
 *
 * 2. **Three of the four are LIMITS, one is a GOAL.** Fiber is something to
 *    reach; sugar/sodium/saturated fat are ceilings to stay under. `MICRO_SPECS`
 *    carries that distinction so the cards and the health score both read it
 *    from one place rather than re-deciding per component.
 */

/** The four tracked micronutrients, in the order the cards render. */
export const MICRO_KEYS = ["fiber", "sugar", "sodium", "satFat"] as const;
export type MicroKey = (typeof MICRO_KEYS)[number];

/** Is this nutrient something to REACH (fiber) or a ceiling to stay UNDER? */
export type MicroKind = "goal" | "limit";

export interface MicroSpec {
  key: MicroKey;
  /** Serbian card label, e.g. "Vlakna". */
  labelSr: string;
  /** Unit as shown to the user: grams for three, milligrams for sodium. */
  unit: "g" | "mg";
  kind: MicroKind;
}

export const MICRO_SPECS: Record<MicroKey, MicroSpec> = {
  fiber: { key: "fiber", labelSr: "Vlakna", unit: "g", kind: "goal" },
  sugar: { key: "sugar", labelSr: "Šećer", unit: "g", kind: "limit" },
  // "So" (salt) is what a Serbian speaker reads off a declaration and thinks
  // about, but the NUMBER we track is sodium in mg (the internationally stated
  // limit, and what labels give as "natrijum"). `saltGramsFromSodiumMg` below
  // converts when we want to speak in salt.
  sodium: { key: "sodium", labelSr: "So", unit: "mg", kind: "limit" },
  satFat: {
    key: "satFat",
    labelSr: "Zasićene masti",
    unit: "g",
    kind: "limit",
  },
};

/** One set of daily numbers: fiber goal + three ceilings. Whole units. */
export type MicroTargets = Record<MicroKey, number>;

/** A set of per-entry (or per-day) amounts; `null` = unknown. */
export type MicroValues = Record<MicroKey, number | null>;

export const EMPTY_MICRO_VALUES: MicroValues = {
  fiber: null,
  sugar: null,
  sodium: null,
  satFat: null,
};

// ---------------------------------------------------------------- daily targets

// Reference values, all mainstream clinical guidance (the same sources the
// budget engine's own doctor review leaned on):
//   * Fiber   -- 14 g per 1000 kcal (US Dietary Guidelines / IOM adequate
//                intake). Scales with the calorie budget, so a 1500 kcal cut
//                isn't held to a 3000 kcal eater's fiber wall.
//   * Sugar   -- under 10% of energy (WHO free-sugars recommendation), at 4
//                kcal/g => 0.025 g per kcal. NOTE: what we can actually measure
//                from a photo/label is TOTAL sugars (free + naturally
//                occurring), which is stricter than WHO's "free sugars" wording.
//                Treated as a soft ceiling for exactly that reason -- going over
//                on a fruit-heavy day is not a failure, and nothing in the UI
//                shames it.
//   * Sodium  -- 2300 mg/day (US DGA upper limit; WHO's is a stricter 2000 mg).
//                Deliberately NOT scaled by calories: the kidney doesn't care
//                how big your deficit is.
//   * Sat fat -- under 10% of energy (DGA), at 9 kcal/g => 0.0111 g per kcal.
const FIBER_G_PER_1000_KCAL = 14;
const SUGAR_ENERGY_FRACTION = 0.1;
const SAT_FAT_ENERGY_FRACTION = 0.1;
export const SODIUM_MG_LIMIT = 2300;

// Clamps keep the derived numbers sane at the extremes of the calorie range
// (a 1200 kcal cut shouldn't get a 17 g fiber goal that reads as "fiber doesn't
// matter"; a 4000 kcal bulk shouldn't get a 56 g wall nobody hits).
const FIBER_G_MIN = 20;
const FIBER_G_MAX = 45;
const SUGAR_G_MIN = 20;
const SUGAR_G_MAX = 100;
const SAT_FAT_G_MIN = 10;
const SAT_FAT_G_MAX = 40;

function clampRound(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Derives the day's four micronutrient numbers from the calorie budget the
 * user is already on (`targets.daily_kcal`, so an adapted target automatically
 * adapts these too). Whole units, clamped to sane bounds. A non-positive or
 * non-finite kcal input degrades to the minimum sane set rather than throwing --
 * callers should prefer their own "no target set" empty state.
 */
export function microTargetsForKcal(dailyKcal: number): MicroTargets {
  const kcal = Number.isFinite(dailyKcal) ? Math.max(0, dailyKcal) : 0;
  return {
    fiber: clampRound(
      (kcal / 1000) * FIBER_G_PER_1000_KCAL,
      FIBER_G_MIN,
      FIBER_G_MAX
    ),
    sugar: clampRound(
      (kcal * SUGAR_ENERGY_FRACTION) / 4,
      SUGAR_G_MIN,
      SUGAR_G_MAX
    ),
    sodium: SODIUM_MG_LIMIT,
    satFat: clampRound(
      (kcal * SAT_FAT_ENERGY_FRACTION) / 9,
      SAT_FAT_G_MIN,
      SAT_FAT_G_MAX
    ),
  };
}

/** Salt (NaCl) grams from sodium milligrams -- `mg * 2.5 / 1000`. Handy when
 * copy talks about "so" the way a label does; the tracked number stays sodium. */
export function saltGramsFromSodiumMg(sodiumMg: number): number {
  return Math.round((sodiumMg * 2.5) / 1000 * 10) / 10;
}

// --------------------------------------------------------- per-entry resolution

/** The per-100g micro columns as they arrive from a `foods` row (any of them
 * may be absent/unknown). */
export interface MicroPer100g {
  fiber_100g?: number | null;
  sugar_100g?: number | null;
  sodium_100g?: number | null;
  sat_fat_100g?: number | null;
}

/** The per-entry micro columns as they arrive from a `logs` row. */
export interface MicroLogColumns {
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  sat_fat?: number | null;
}

/** A log row as the home screen sees it: its own (possibly unknown) snapshot,
 * its kcal, its grams, and the catalog food it points at (if any). */
export interface MicroLogInput extends MicroLogColumns {
  kcal: number;
  grams: number;
  food?: MicroPer100g | null;
}

function normalise(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Scales a food's per-100g micro values to a gram amount --
 * `value_100g * (grams / 100)`, one decimal, exactly like
 * `computeMacrosForGrams` does for the macros. Unknown stays unknown (`null`),
 * it never becomes 0.
 */
export function microForGrams(
  food: MicroPer100g | null | undefined,
  grams: number
): MicroValues {
  if (!food || !Number.isFinite(grams) || grams <= 0) {
    return { ...EMPTY_MICRO_VALUES };
  }
  const multiplier = grams / 100;
  const scale = (per100g: number | null | undefined): number | null => {
    const value = normalise(per100g);
    return value === null ? null : roundToOneDecimal(value * multiplier);
  };
  return {
    fiber: scale(food.fiber_100g),
    sugar: scale(food.sugar_100g),
    sodium: scale(food.sodium_100g),
    satFat: scale(food.sat_fat_100g),
  };
}

/**
 * The four values for ONE logged entry: the row's own snapshot when present,
 * otherwise derived from the referenced catalog food's per-100g values.
 *
 * The fallback is what makes the AI backfill work retroactively: an entry logged
 * before its food had micro data shows up complete as soon as the catalog row is
 * filled (`scripts/backfill-food-micro.ts`), without rewriting log history --
 * which the snapshot convention in `0004_foods_logs.sql` forbids anyway.
 */
export function resolveLogMicros(log: MicroLogInput): MicroValues {
  const derived = microForGrams(log.food, log.grams);
  return {
    fiber: normalise(log.fiber) ?? derived.fiber,
    sugar: normalise(log.sugar) ?? derived.sugar,
    sodium: normalise(log.sodium) ?? derived.sodium,
    satFat: normalise(log.sat_fat) ?? derived.satFat,
  };
}

// ------------------------------------------------------------------ day totals

export interface MicroTotal {
  /** Summed amount across the entries that HAVE a value for this nutrient. */
  value: number;
  /** kcal of the entries that contributed above -- the numerator of coverage. */
  coveredKcal: number;
  /** True when at least one entry contributed a value. */
  hasData: boolean;
}

export interface MicroTotals {
  totals: Record<MicroKey, MicroTotal>;
  /** Total kcal of every entry considered (the denominator of coverage). */
  totalKcal: number;
  /**
   * Fraction of the day's kcal whose micro values are known, taken as the WORST
   * of the four nutrients (0..1). 1 = every entry is fully described; 0 = we
   * know nothing. An empty day is 1 (nothing unknown), so an untouched day never
   * renders a "podaci su nepotpuni" warning.
   */
  coverage: number;
}

/**
 * Sums the day's four micronutrients across log rows, tracking per-nutrient
 * coverage as it goes (see the file header: unknown is not zero). Never throws;
 * an empty list yields all-zero totals with full coverage.
 */
export function computeMicroTotals(logs: MicroLogInput[]): MicroTotals {
  const totals: Record<MicroKey, MicroTotal> = {
    fiber: { value: 0, coveredKcal: 0, hasData: false },
    sugar: { value: 0, coveredKcal: 0, hasData: false },
    sodium: { value: 0, coveredKcal: 0, hasData: false },
    satFat: { value: 0, coveredKcal: 0, hasData: false },
  };
  let totalKcal = 0;

  for (const log of logs) {
    const kcal = Number.isFinite(log.kcal) ? Math.max(0, log.kcal) : 0;
    totalKcal += kcal;
    const micros = resolveLogMicros(log);
    for (const key of MICRO_KEYS) {
      const value = micros[key];
      if (value === null) continue;
      const total = totals[key];
      total.value = roundToOneDecimal(total.value + value);
      total.coveredKcal += kcal;
      total.hasData = true;
    }
  }

  const coverage =
    totalKcal <= 0
      ? 1
      : Math.min(
          ...MICRO_KEYS.map((key) =>
            Math.min(1, totals[key].coveredKcal / totalKcal)
          )
        );

  return { totals, totalKcal, coverage };
}

// -------------------------------------------------------------------- per-card

export interface MicroCardState {
  key: MicroKey;
  spec: MicroSpec;
  /** Whole consumed amount for the day. */
  consumed: number;
  /** Whole daily goal/limit. */
  target: number;
  /** SIGNED remaining (target - consumed): negative once past a limit/goal. */
  remaining: number;
  /** consumed / target, clamped to [0, 1] -- fills the card's little ring. */
  fillFraction: number;
  /** True once consumed exceeds the target. For a `limit` that's the warning
   * state; for the `goal` (fiber) it simply means "reached, well done". */
  isOver: boolean;
  /** False when not a single entry described this nutrient (card shows "—"). */
  hasData: boolean;
}

/**
 * Turns one nutrient's day total + target into everything its card renders.
 * Whole units (nobody needs 0.4 g of sodium), clamped fill, signed remaining --
 * the same shape `computeRingState` gives the calorie gauge.
 */
export function computeMicroCardState(
  key: MicroKey,
  total: MicroTotal,
  target: number
): MicroCardState {
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const consumed = Math.round(Math.max(0, total.value));
  const denom = safeTarget > 0 ? safeTarget : 1;
  return {
    key,
    spec: MICRO_SPECS[key],
    consumed,
    target: Math.round(safeTarget),
    remaining: Math.round(safeTarget - consumed),
    fillFraction: Math.min(1, Math.max(0, consumed / denom)),
    isOver: consumed > safeTarget,
    hasData: total.hasData,
  };
}

/** `38` + `"g"` -> `"38 g"`; thousands get a Serbian dot separator so 2300 mg
 * reads as "2.300 mg" like every other big number in the app. */
export function formatMicroAmount(value: number, unit: "g" | "mg"): string {
  const whole = Math.round(Math.abs(value));
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return `${sign}${grouped} ${unit}`;
}
