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

// ---------------------------------------------------------------------
// Continuous dial (rotary "prsten") — the `tempo` step lets the user pick
// ANY weekly rate between the slow and fast bounds, not just the three
// discrete stops. The dial's position `t` ∈ [0,1] maps linearly onto the
// weekly-kg range, and from that + the target delta we derive the whole-week
// timeframe the rest of the pipeline already speaks (budget engine + DB).
// Nothing downstream changes: only the mapping from a chosen rate → weeks.
// ---------------------------------------------------------------------

/** The continuous weekly-rate bounds the dial sweeps between: the slow rate
 * (0.25 kg/week) at t=0 and the fast rate (0.75 kg/week) at t=1, with the
 * recommended 0.5 kg/week landing exactly at the t=0.5 midpoint. */
export const PACE_MIN_WEEKLY_KG = PACE_WEEKLY_KG.slow;
export const PACE_MAX_WEEKLY_KG = PACE_WEEKLY_KG.fast;

/** Weekly kg for a continuous dial position `t` ∈ [0,1] (0 = slow … 1 = fast).
 * Linear, so the recommended rate sits at the exact center of the sweep. */
export function weeklyKgForPosition(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return PACE_MIN_WEEKLY_KG + (PACE_MAX_WEEKLY_KG - PACE_MIN_WEEKLY_KG) * c;
}

/** Inverse of `weeklyKgForPosition`: the dial position that yields a given
 * weekly rate, clamped to [0,1]. */
export function positionForWeeklyKg(kg: number): number {
  const span = PACE_MAX_WEEKLY_KG - PACE_MIN_WEEKLY_KG;
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (kg - PACE_MIN_WEEKLY_KG) / span));
}

/** Whole weeks (≥ 1) to move `deltaKg` of bodyweight at a continuous weekly
 * rate — the continuous sibling of `timeframeWeeksForPace`. */
export function timeframeWeeksForWeeklyKg(
  deltaKg: number,
  weeklyKg: number
): number {
  if (!Number.isFinite(deltaKg) || deltaKg <= 0 || weeklyKg <= 0) return 1;
  return Math.max(1, Math.round(deltaKg / weeklyKg));
}

/**
 * The dial position implied by an already-derived timeframe + delta — used to
 * RESTORE the dial when the user navigates back to the tempo step (the wizard
 * only keeps `timeframeWeeks`, not the raw position). Returns `null` when there
 * isn't enough to reconstruct it, so the caller can fall back to the default.
 */
export function positionForTimeframe(
  deltaKg: number | null,
  timeframeWeeks: number | null
): number | null {
  if (deltaKg === null || timeframeWeeks === null) return null;
  if (!Number.isFinite(deltaKg) || deltaKg <= 0 || timeframeWeeks <= 0) {
    return null;
  }
  return positionForWeeklyKg(deltaKg / timeframeWeeks);
}

/** RGB anchors for the DIAL ramp (distinct from the neutral-white slider ramp
 * above): dull olive-yellow ("trula žuta", too slow) → green (the recommended
 * sweet spot) → red (too aggressive). So the color itself tells the story as
 * the user rotates: yellow = meh, green = ideal, red = punishing. */
const RING_SLOW_RGB = [193, 155, 42]; // "trula žuta"
const RING_REC_RGB = [44, 122, 88]; // sage (#2C7A58, `--macro-protein`)
const RING_FAST_RGB = [192, 80, 40]; // terracotta (#C05028, `--macro-fat`)

/**
 * The dial color for a continuous position `t` ∈ [0,1]: olive-yellow at the
 * slow end, green through the recommended middle, red at the fast end. Used on
 * the active arc, the handle ring and the center readout so the whole control
 * shifts color as the user drags toward a faster/slower goal.
 */
export function paceRingColorAt(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  const rgb =
    c <= 0.5
      ? mixRgb(RING_SLOW_RGB, RING_REC_RGB, c / 0.5)
      : mixRgb(RING_REC_RGB, RING_FAST_RGB, (c - 0.5) / 0.5);
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
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
