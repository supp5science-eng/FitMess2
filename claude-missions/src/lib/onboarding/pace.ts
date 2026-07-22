/**
 * Weight-change PACE — the "how fast do you want to reach your goal" step.
 *
 * Instead of asking the user for a raw timeframe in weeks, we ask for a pace
 * (slow / recommended / fast). Each pace is a target weekly weight change in
 * kg; from that + the total delta (|current − target|) we DERIVE the timeframe
 * in weeks, which is what the rest of the pipeline already speaks
 * (`OnboardingData.timeframeWeeks` → budget engine → `targets.timeframe_weeks`
 * in the DB). So the pace choice flows all the way to the database as the
 * stored timeframe, with no schema change.
 *
 * Pure + framework-free so it can be unit-tested and reused by both the step
 * UI (live "reach your goal in ~N months" + daily-kcal preview) and any
 * headless caller.
 */

export type WeightChangePace = "slow" | "recommended" | "fast";

/** Left→right order for the slider (slow … fast). */
export const PACE_ORDER: WeightChangePace[] = ["slow", "recommended", "fast"];

/** Target weekly weight change (kg) per pace. "recommended" (0.5 kg/week) is
 * the balanced default most guidance points to; "slow" is gentler and easier
 * to sustain, "fast" is more aggressive (the budget engine still clamps the
 * daily deficit/surplus to safe bounds, so "fast" can't push past ~25%). */
export const PACE_WEEKLY_KG: Record<WeightChangePace, number> = {
  slow: 0.25,
  recommended: 0.5,
  fast: 0.75,
};

/** Serbian (ti-form) label per pace. */
export const PACE_LABELS: Record<WeightChangePace, string> = {
  slow: "Sporo",
  recommended: "Preporučeno",
  fast: "Brzo",
};

/** Short, calm Serbian explanation shown for the currently-selected pace. */
export const PACE_DESCRIPTIONS: Record<WeightChangePace, string> = {
  slow: "Najblaži tempo — najlakše se održava i najbolje čuva mišiće. Traje malo duže, ali retko ko odustane.",
  recommended:
    "Najuravnoteženiji tempo — dovoljno brz da te motiviše, a održiv. Idealan za većinu.",
  fast: "Najbrži rezultat, ali traži više discipline i lakše se posustane. Biraj samo ako si spreman/na na strože rezove.",
};

/** The default pace a fresh questionnaire starts on. */
export const DEFAULT_PACE: WeightChangePace = "recommended";

/** RGB anchor colors for the slider ramp. */
const SLOW_RGB = [201, 168, 44]; // "trula žuta" — dull olive-yellow (too slow)
const MID_RGB = [255, 255, 255]; // neutral white at the recommended default
const FAST_RGB = [239, 68, 68]; // red (too aggressive)

function mixRgb(a: number[], b: number[], k: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * k));
}

/**
 * The color for a slider position `t` in [0, 1] (0 = slow, 0.5 = recommended,
 * 1 = fast). Neutral WHITE at the recommended default, warming to a dull
 * olive-yellow toward "too slow" and to red toward "too fast" — so the thumb
 * only takes on color once the user moves away from the balanced middle.
 */
export function paceColorAt(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  const rgb =
    c <= 0.5
      ? mixRgb(SLOW_RGB, MID_RGB, c / 0.5)
      : mixRgb(MID_RGB, FAST_RGB, (c - 0.5) / 0.5);
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

/** Normalized slider position [0,1] for a discrete pace. */
export function paceToPosition(pace: WeightChangePace): number {
  const i = PACE_ORDER.indexOf(pace);
  return i < 0 ? 0.5 : i / (PACE_ORDER.length - 1);
}

/** Nearest discrete pace for a normalized slider position [0,1]. */
export function positionToPace(t: number): WeightChangePace {
  const idx = Math.round(Math.min(1, Math.max(0, t)) * (PACE_ORDER.length - 1));
  return PACE_ORDER[idx];
}

/** The accent color for a discrete pace (its settled slider color). */
export function paceColor(pace: WeightChangePace): string {
  return paceColorAt(paceToPosition(pace));
}


/**
 * Derive the timeframe (whole weeks, ≥ 1) needed to move `deltaKg` of
 * bodyweight at the given pace. `deltaKg` is the absolute difference between
 * current and target weight.
 */
export function timeframeWeeksForPace(
  deltaKg: number,
  pace: WeightChangePace
): number {
  const perWeek = PACE_WEEKLY_KG[pace];
  if (!Number.isFinite(deltaKg) || deltaKg <= 0 || perWeek <= 0) return 1;
  return Math.max(1, Math.round(deltaKg / perWeek));
}

/** Serbian pluralization for "nedelja". */
export function weeksWord(weeks: number): string {
  const abs = Math.abs(weeks) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return "nedelja";
  if (last === 1) return "nedelja"; // "1 nedelja"
  if (last >= 2 && last <= 4) return "nedelje";
  return "nedelja";
}

/** Serbian pluralization for "mesec". */
export function monthsWord(months: number): string {
  const abs = Math.abs(months) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return "meseci";
  if (last === 1) return "mesec";
  if (last >= 2 && last <= 4) return "meseca";
  return "meseci";
}

/**
 * Human, Serbian "za koliko" readout for a number of weeks — always expressed
 * in weeks (never rolled up to months), per product direction.
 */
export function formatTimeToGoal(weeks: number): string {
  const w = Math.max(1, Math.round(weeks));
  return `${w} ${weeksWord(w)}`;
}
