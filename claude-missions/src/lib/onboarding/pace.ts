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

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/**
 * The accent color for a slider position `t` in [0, 1] (0 = slow, 0.5 =
 * recommended, 1 = fast). A calm, meaningful ramp: a dull olive-yellow at the
 * "too slow" end, the nicest vivid green in the recommended middle ("this is
 * good"), and an alarming red at the "too fast" end. Interpolated in HSL so
 * the hue glides smoothly instead of muddying through grey.
 */
export function paceColorAt(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  let h: number;
  let s: number;
  let l: number;
  if (c <= 0.5) {
    const k = c / 0.5; // dull olive-yellow -> emerald green
    h = lerp(48, 146, k);
    s = lerp(44, 66, k);
    l = lerp(50, 44, k);
  } else {
    const k = (c - 0.5) / 0.5; // emerald green -> red (through a warm ramp)
    h = lerp(146, 4, k);
    s = lerp(66, 82, k);
    l = lerp(44, 56, k);
  }
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
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

/** Approximate weeks in a month, for the "reach your goal in ~N months"
 * readout. */
const WEEKS_PER_MONTH = 4.345;

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
 * Human, Serbian "za koliko" readout for a number of weeks. Short spans read
 * as weeks; from ~8 weeks up we switch to whole months (rounded) so the
 * headline stays friendly ("za ~3 meseca") like the reference design.
 */
export function formatTimeToGoal(weeks: number): string {
  const w = Math.max(1, Math.round(weeks));
  if (w < 8) return `${w} ${weeksWord(w)}`;
  const months = Math.max(1, Math.round(w / WEEKS_PER_MONTH));
  return `${months} ${monthsWord(months)}`;
}
