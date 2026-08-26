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

/**
 * How much of the travel still counts as "they tapped, they did not pull".
 *
 * Nobody presses a 40px circle with a thumb and moves it exactly zero pixels,
 * so an exact-zero test would classify most taps as aborted micro-drags and
 * the button would answer them with nothing at all — which is the one thing a
 * gesture-only control cannot afford, since a dead tap is indistinguishable
 * from a broken button.
 */
const TAP_SLOP = 0.12;

/**
 * Whether a finished gesture was a tap rather than an abandoned pull.
 *
 * A tap does not leave — that is the point — but it is answered, so the two
 * cases have to be told apart: this one gets the hop that teaches the gesture,
 * a real pull that stopped short just springs back in silence, having already
 * shown the user how far it got.
 */
export function isPullTap(progress: number): boolean {
  return progress < TAP_SLOP;
}
