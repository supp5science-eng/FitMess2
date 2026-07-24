import type { MealEstimate } from "@/lib/ai/meal-estimate";

// Deterministic sanity pass over whatever the model returned. A language model
// can produce an itemised breakdown that adds up to 640 kcal and then, two
// fields later, state a total of 900 -- both written fluently, neither checked.
// Nothing downstream would catch that: the estimate goes straight into `logs`
// and silently skews the user's day.
//
// So we check the two things that are arithmetic rather than opinion:
//
//   1. The components must add up to the stated total.
//   2. The macros must add up to the stated calories (Atwater: 4/4/9).
//
// This runs only on the iPeach path, where we ask for the breakdown. It never
// invents numbers -- it only picks which of the model's own figures to trust
// when they disagree, and lowers confidence when it had to intervene.

/** kcal per gram, Atwater factors. */
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

/** Below this relative gap we leave the model's numbers alone -- rounding and
 * fibre/alcohol mean Atwater never lands exactly, and "correcting" a 5% gap
 * would be false precision. */
const TOLERANCE = 0.12;

/** The components have to describe roughly the same plate as the total weight;
 * outside this band they are probably a partial list, so we don't trust their
 * sum over the model's own total. */
const WEIGHT_AGREEMENT_MIN = 0.7;
const WEIGHT_AGREEMENT_MAX = 1.35;

export interface ReconcileResult {
  estimate: MealEstimate;
  /** What we had to fix, for logging/debugging. Empty when the model was
   * internally consistent (the common case). */
  corrections: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Relative gap between two numbers, guarded against a zero denominator. */
function relativeGap(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale === 0 ? 0 : Math.abs(a - b) / scale;
}

export function kcalFromMacros(
  protein: number,
  carbs: number,
  fat: number
): number {
  return (
    protein * KCAL_PER_G_PROTEIN +
    carbs * KCAL_PER_G_CARB +
    fat * KCAL_PER_G_FAT
  );
}

/**
 * Reconcile an iPeach estimate with itself. Returns a corrected copy plus a
 * list of what changed; never throws, never fabricates a value that isn't
 * derived from the model's own output.
 */
export function reconcileEstimate(estimate: MealEstimate): ReconcileResult {
  const corrections: string[] = [];
  let { kcal, protein_g, uh_g, mast_g, procenjeni_grami } = estimate;

  // --- 1. Components vs totals ---------------------------------------------
  // A breakdown is the model showing its work, so when it disagrees with the
  // headline number the breakdown is the better bet -- but only if it covers
  // the whole plate (see WEIGHT_AGREEMENT_*), otherwise a partial list would
  // drag the total down.
  const parts = estimate.komponente;
  if (parts.length > 0) {
    const sum = parts.reduce(
      (acc, c) => ({
        grami: acc.grami + c.grami,
        kcal: acc.kcal + c.kcal,
        protein: acc.protein + c.protein_g,
        carbs: acc.carbs + c.uh_g,
        fat: acc.fat + c.mast_g,
      }),
      { grami: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const weightRatio =
      procenjeni_grami > 0 ? sum.grami / procenjeni_grami : 0;
    const coversPlate =
      sum.grami > 0 &&
      weightRatio >= WEIGHT_AGREEMENT_MIN &&
      weightRatio <= WEIGHT_AGREEMENT_MAX;

    if (coversPlate && sum.kcal > 0 && relativeGap(sum.kcal, kcal) > TOLERANCE) {
      corrections.push(
        `total kcal ${Math.round(kcal)} -> ${Math.round(sum.kcal)} (sum of ${parts.length} components)`
      );
      kcal = sum.kcal;
      protein_g = sum.protein;
      uh_g = sum.carbs;
      mast_g = sum.fat;
      procenjeni_grami = sum.grami;
    }
  }

  // --- 2. Atwater: macros vs calories --------------------------------------
  // Calories are a function of the macros, not an independent observation. If
  // they disagree past tolerance the macros win: they are what the breakdown
  // was built from, and they are what the daily protein/carb/fat rings use.
  const derived = kcalFromMacros(protein_g, uh_g, mast_g);
  const macrosPresent = protein_g + uh_g + mast_g > 0;

  if (macrosPresent && relativeGap(derived, kcal) > TOLERANCE) {
    corrections.push(
      `kcal ${Math.round(kcal)} -> ${Math.round(derived)} (Atwater 4/4/9)`
    );
    kcal = derived;
  }

  // A correction means the model contradicted itself somewhere, which is not
  // the profile of a confident read -- don't let it claim "visoka".
  const sigurnost =
    corrections.length > 0 && estimate.sigurnost === "visoka"
      ? "srednja"
      : estimate.sigurnost;

  return {
    estimate: {
      ...estimate,
      procenjeni_grami: Math.max(1, Math.round(procenjeni_grami)),
      kcal: Math.round(kcal),
      protein_g: round1(protein_g),
      uh_g: round1(uh_g),
      mast_g: round1(mast_g),
      sigurnost,
    },
    corrections,
  };
}
