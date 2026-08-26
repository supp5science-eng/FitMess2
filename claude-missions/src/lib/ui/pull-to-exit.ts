/**
 * The pull-to-exit gesture, as arithmetic.
 *
 * One number decides everything the control does — how red it is, how far it
 * has travelled, and whether letting go leaves the screen — so that number is
 * computed here, in a pure function, rather than three times inside three
 * event handlers. The component is then only the wiring.
 *
 * The mapping is deliberately blunt: **fully red means armed.** Progress runs
 * 0 → 1 across {@link PULL_EXIT_DISTANCE_PX} of upward travel, the fill's
 * opacity IS that progress, and the release fires at exactly 1. So the user
 * never has to guess where the threshold is — the colour is the threshold, and
 * a half-red button visibly will not do anything yet.
 */

/**
 * How far up the finger travels before releasing leaves the screen.
 *
 * Long enough that a stray upward flick while reaching for the mode pill can't
 * throw you out of the screen (the thing the gesture exists to prevent), short
 * enough to finish inside a thumb's natural arc from a control this close to
 * the top edge.
 */
export const PULL_EXIT_DISTANCE_PX = 64;

/**
 * How far along the gesture is, 0 → 1.
 *
 * @param dy Upward travel in CSS pixels: `startY - currentY`, so pulling *up*
 *   is positive and pulling down is negative.
 * @param distance Travel that counts as a complete pull.
 */
export function pullProgress(
  dy: number,
  distance: number = PULL_EXIT_DISTANCE_PX
): number {
  // `!(… > 0)` rather than `<= 0` so a NaN distance lands here too.
  if (!Number.isFinite(dy) || !(distance > 0)) return 0;
  // Downward travel is not a negative pull, it is no pull: the control must
  // not go *more* pale than at rest, and must not bank progress to be undone.
  if (dy <= 0) return 0;
  return Math.min(1, dy / distance);
}

/** Whether letting go now leaves the screen. True exactly when fully red. */
export function isPullArmed(progress: number): boolean {
  return progress >= 1;
}
